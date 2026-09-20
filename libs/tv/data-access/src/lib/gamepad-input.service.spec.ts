import { TestBed } from '@angular/core/testing';
import type { TvGamepadAction } from '@iptvnator/tv/util';
import { GamepadInputService } from './gamepad-input.service';

interface FakeGamepad {
    buttons: { pressed: boolean }[];
    axes: number[];
}

function createFakeGamepad(): FakeGamepad {
    return {
        buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
        axes: [0, 0],
    };
}

describe('GamepadInputService', () => {
    let fakeGamepad: FakeGamepad;
    let rafCallback: FrameRequestCallback | null;

    function pumpFrame(nowMs: number): void {
        (performance.now as jest.Mock).mockReturnValue(nowMs);
        const callback = rafCallback;
        rafCallback = null;
        callback?.(nowMs);
    }

    function collectActions(service: GamepadInputService): TvGamepadAction[] {
        const actions: TvGamepadAction[] = [];
        service.actions$.subscribe((action) => actions.push(action));
        return actions;
    }

    beforeEach(() => {
        fakeGamepad = createFakeGamepad();
        rafCallback = null;

        // jsdom implements neither getGamepads() nor gamepadconnected — stub
        // it directly (assignment, not spyOn, since the property doesn't
        // already exist).
        (navigator as unknown as { getGamepads: () => (Gamepad | null)[] })
            .getGamepads = () =>
            [fakeGamepad, null, null, null] as unknown as (Gamepad | null)[];

        jest.spyOn(window, 'requestAnimationFrame').mockImplementation(
            (cb) => {
                rafCallback = cb;
                return 1;
            }
        );
        jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(
            () => undefined
        );
        jest.spyOn(performance, 'now').mockReturnValue(0);

        TestBed.configureTestingModule({});
    });

    afterEach(() => {
        jest.restoreAllMocks();
        delete (navigator as { getGamepads?: unknown }).getGamepads;
    });

    it('starts polling on construction', () => {
        TestBed.inject(GamepadInputService);
        expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
    });

    it('emits a direction action once for a d-pad press', () => {
        const actions = collectActions(TestBed.inject(GamepadInputService));
        fakeGamepad.buttons[13].pressed = true; // Down
        pumpFrame(0);
        expect(actions).toEqual([{ kind: 'direction', direction: 'down' }]);
    });

    it('does not repeat direction before the initial delay', () => {
        const actions = collectActions(TestBed.inject(GamepadInputService));
        fakeGamepad.buttons[13].pressed = true;
        pumpFrame(0);
        pumpFrame(100);
        pumpFrame(399);
        expect(actions).toEqual([{ kind: 'direction', direction: 'down' }]);
    });

    it('repeats direction after the initial delay, then on interval', () => {
        const actions = collectActions(TestBed.inject(GamepadInputService));
        fakeGamepad.buttons[13].pressed = true;
        pumpFrame(0);
        pumpFrame(400);
        pumpFrame(500);
        pumpFrame(550);
        expect(actions).toEqual([
            { kind: 'direction', direction: 'down' },
            { kind: 'direction', direction: 'down' },
            { kind: 'direction', direction: 'down' },
        ]);
    });

    it('stops repeating once the button is released', () => {
        const actions = collectActions(TestBed.inject(GamepadInputService));
        fakeGamepad.buttons[13].pressed = true;
        pumpFrame(0);
        fakeGamepad.buttons[13].pressed = false;
        pumpFrame(400);
        pumpFrame(800);
        expect(actions).toEqual([{ kind: 'direction', direction: 'down' }]);
    });

    it('emits activate once and never repeats while held', () => {
        const actions = collectActions(TestBed.inject(GamepadInputService));
        fakeGamepad.buttons[0].pressed = true; // A
        pumpFrame(0);
        pumpFrame(1000);
        pumpFrame(2000);
        expect(actions).toEqual([{ kind: 'activate' }]);
    });

    it('emits back once for the B button', () => {
        const actions = collectActions(TestBed.inject(GamepadInputService));
        fakeGamepad.buttons[1].pressed = true; // B
        pumpFrame(0);
        expect(actions).toEqual([{ kind: 'back' }]);
    });

    it('emits categoryStep for the shoulder buttons and lets it repeat', () => {
        const actions = collectActions(TestBed.inject(GamepadInputService));
        fakeGamepad.buttons[5].pressed = true; // RB / R1
        pumpFrame(0);
        pumpFrame(400);
        expect(actions).toEqual([
            { kind: 'categoryStep', direction: 'next' },
            { kind: 'categoryStep', direction: 'next' },
        ]);
    });

    it('maps LB / L1 to the previous categoryStep', () => {
        const actions = collectActions(TestBed.inject(GamepadInputService));
        fakeGamepad.buttons[4].pressed = true; // LB / L1
        pumpFrame(0);
        expect(actions).toEqual([
            { kind: 'categoryStep', direction: 'previous' },
        ]);
    });

    it('resolves the left stick into a direction past the deadzone', () => {
        const actions = collectActions(TestBed.inject(GamepadInputService));
        fakeGamepad.axes = [1, 0];
        pumpFrame(0);
        expect(actions).toEqual([{ kind: 'direction', direction: 'right' }]);
    });

    it('ignores the stick inside the deadzone', () => {
        const actions = collectActions(TestBed.inject(GamepadInputService));
        fakeGamepad.axes = [0.2, 0.1];
        pumpFrame(0);
        expect(actions).toEqual([]);
    });

    it('stops polling and completes actions$ on destroy', () => {
        const service = TestBed.inject(GamepadInputService);
        let completed = false;
        service.actions$.subscribe({ complete: () => (completed = true) });
        service.ngOnDestroy();
        expect(window.cancelAnimationFrame).toHaveBeenCalledTimes(1);
        expect(completed).toBe(true);
    });

    it('does not poll when the Gamepad API is unavailable', () => {
        delete (navigator as { getGamepads?: unknown }).getGamepads;
        TestBed.inject(GamepadInputService);
        expect(window.requestAnimationFrame).not.toHaveBeenCalled();
    });
});
