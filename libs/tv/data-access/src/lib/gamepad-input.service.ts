import { Injectable, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import {
    GAMEPAD_BUTTON_ACTIONS,
    GAMEPAD_REPEATABLE_BUTTONS,
    GamepadEdgeTracker,
    GamepadHoldRepeater,
    GridFocusDirection,
    TvGamepadAction,
    resolveGamepadStickDirection,
} from '@iptvnator/tv/util';

const BUTTON_KEY_PREFIX = 'btn:';
const STICK_KEY_PREFIX = 'stick:';

/**
 * Polls `navigator.getGamepads()` every animation frame and emits the same
 * `TvGamepadAction`s the keyboard directive's events translate to, so
 * `TvLiveScreenComponent` drives both from one set of handlers. Real
 * `requestAnimationFrame`/`navigator.getGamepads` polling is impure, which is
 * why this lives in data-access rather than util (see the tv-mode plan's
 * "New Nx projects" section).
 */
@Injectable({ providedIn: 'root' })
export class GamepadInputService implements OnDestroy {
    private readonly actionsSubject = new Subject<TvGamepadAction>();
    readonly actions$ = this.actionsSubject.asObservable();

    private readonly edgeTracker = new GamepadEdgeTracker<string>();
    private readonly holdRepeater = new GamepadHoldRepeater<string>();
    private frameId: number | null = null;

    constructor() {
        if (
            typeof navigator !== 'undefined' &&
            typeof navigator.getGamepads === 'function' &&
            typeof requestAnimationFrame === 'function'
        ) {
            this.frameId = requestAnimationFrame(this.poll);
        }
    }

    ngOnDestroy(): void {
        if (this.frameId !== null) {
            cancelAnimationFrame(this.frameId);
            this.frameId = null;
        }
        this.actionsSubject.complete();
    }

    private readonly poll = (): void => {
        const now = performance.now();
        const oneShotKeys = new Set<string>();
        const repeatableKeys = new Set<string>();

        for (const gamepad of navigator.getGamepads()) {
            if (!gamepad) {
                continue;
            }
            for (const index of GAMEPAD_BUTTON_ACTIONS.keys()) {
                if (!gamepad.buttons[index]?.pressed) {
                    continue;
                }
                const key = `${BUTTON_KEY_PREFIX}${index}`;
                if (GAMEPAD_REPEATABLE_BUTTONS.has(index)) {
                    repeatableKeys.add(key);
                } else {
                    oneShotKeys.add(key);
                }
            }
            const stickDirection = resolveGamepadStickDirection(
                gamepad.axes[0] ?? 0,
                gamepad.axes[1] ?? 0
            );
            if (stickDirection) {
                repeatableKeys.add(`${STICK_KEY_PREFIX}${stickDirection}`);
            }
        }

        for (const key of this.edgeTracker.update(oneShotKeys)) {
            this.emitForKey(key);
        }
        for (const key of this.holdRepeater.update(repeatableKeys, now)) {
            this.emitForKey(key);
        }

        this.frameId = requestAnimationFrame(this.poll);
    };

    private emitForKey(key: string): void {
        if (key.startsWith(STICK_KEY_PREFIX)) {
            const direction = key.slice(
                STICK_KEY_PREFIX.length
            ) as GridFocusDirection;
            this.actionsSubject.next({ kind: 'direction', direction });
            return;
        }
        const index = Number(key.slice(BUTTON_KEY_PREFIX.length));
        const action = GAMEPAD_BUTTON_ACTIONS.get(index);
        if (action) {
            this.actionsSubject.next(action);
        }
    }
}
