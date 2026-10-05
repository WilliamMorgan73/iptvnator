import { Directive, HostListener, output } from '@angular/core';
import type { GridFocusDirection } from '@iptvnator/tv/util';

const DIRECTION_KEYS: Readonly<Record<string, GridFocusDirection>> = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
};

const INTERACTIVE_SELECTOR =
    'input, textarea, select, button, [role="button"], a[href], [contenteditable=""], [contenteditable="true"]';

function isForeignInteractiveTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
        return false;
    }
    return target.isContentEditable || target.closest(INTERACTIVE_SELECTOR) !== null;
}

/**
 * Keyboard stand-in for a gamepad D-pad/A/B, same gating pattern as
 * `EpgGuideKeyboardController` (ignore when a dialog/interactive element owns
 * focus). The tv-mode shell has no real DOM focus target — the listener sits
 * on `document` because nothing else claims these keys in tv mode.
 */
@Directive({
    selector: '[appTvKeyboardInput]',
})
export class TvKeyboardInputDirective {
    readonly direction = output<GridFocusDirection>();
    readonly activate = output<void>();
    readonly back = output<void>();
    /** Keyboard stand-in for the gamepad LB/RB shoulder buttons. */
    readonly categoryStep = output<'previous' | 'next'>();
    /** Keyboard stand-in for gamepad Back/Select. */
    readonly toggleSources = output<void>();
    /** Keyboard stand-in for gamepad Y. */
    readonly toggleInfo = output<void>();
    /** Keyboard stand-in for gamepad Start. */
    readonly openSettings = output<void>();
    /** A single digit key (0-9) — no gamepad equivalent in v1, most gamepads
     * have no numeric buttons. See `TvDigitEntryController`. */
    readonly digit = output<number>();
    /** Keyboard stand-in for gamepad X. */
    readonly toggleRecent = output<void>();
    /** Keyboard stand-in for gamepad RT/R2 — starts/stops recording. */
    readonly toggleRecord = output<void>();
    /** Keyboard stand-in for gamepad left stick click — opens/closes the
     * Recordings list. */
    readonly toggleRecordingsList = output<void>();
    /** Keyboard stand-in for gamepad LT/L2 — opens/closes the full guide. */
    readonly openGuide = output<void>();
    /** Keyboard stand-in for gamepad right stick click — opens the Dashboard. */
    readonly openDashboard = output<void>();

    @HostListener('document:keydown', ['$event'])
    onKeydown(event: KeyboardEvent): void {
        if (
            event.defaultPrevented ||
            event.metaKey ||
            event.ctrlKey ||
            event.altKey ||
            isForeignInteractiveTarget(event.target)
        ) {
            return;
        }
        const direction = DIRECTION_KEYS[event.key];
        if (direction) {
            event.preventDefault();
            this.direction.emit(direction);
            return;
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            this.activate.emit();
            return;
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            this.back.emit();
            return;
        }
        // Same physical gesture as EpgGuideKeyboardController's day-stepping.
        if (event.key === 'PageUp') {
            event.preventDefault();
            this.categoryStep.emit('previous');
            return;
        }
        if (event.key === 'PageDown') {
            event.preventDefault();
            this.categoryStep.emit('next');
            return;
        }
        if (event.key === 'Tab') {
            event.preventDefault();
            this.toggleSources.emit();
            return;
        }
        if (event.code === 'KeyI') {
            event.preventDefault();
            this.toggleInfo.emit();
            return;
        }
        if (event.code === 'KeyS') {
            event.preventDefault();
            this.openSettings.emit();
            return;
        }
        if (event.code === 'KeyV') {
            event.preventDefault();
            this.toggleRecent.emit();
            return;
        }
        if (event.code === 'KeyR') {
            event.preventDefault();
            this.toggleRecord.emit();
            return;
        }
        if (event.code === 'KeyL') {
            event.preventDefault();
            this.toggleRecordingsList.emit();
            return;
        }
        if (event.code === 'KeyG') {
            event.preventDefault();
            this.openGuide.emit();
            return;
        }
        if (event.code === 'KeyH') {
            event.preventDefault();
            this.openDashboard.emit();
            return;
        }
        if (/^[0-9]$/.test(event.key)) {
            event.preventDefault();
            this.digit.emit(Number(event.key));
        }
    }
}
