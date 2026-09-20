import { GamepadEdgeTracker, GamepadHoldRepeater } from './gamepad-hold-repeater';

describe('GamepadHoldRepeater', () => {
    it('fires immediately when a key first appears held', () => {
        const repeater = new GamepadHoldRepeater<string>();
        expect(repeater.update(new Set(['a']), 0)).toEqual(['a']);
    });

    it('does not fire again before the initial delay', () => {
        const repeater = new GamepadHoldRepeater<string>();
        repeater.update(new Set(['a']), 0);
        expect(repeater.update(new Set(['a']), 100)).toEqual([]);
        expect(repeater.update(new Set(['a']), 399)).toEqual([]);
    });

    it('repeats after the initial delay, then every interval', () => {
        const repeater = new GamepadHoldRepeater<string>();
        repeater.update(new Set(['a']), 0);
        expect(repeater.update(new Set(['a']), 400)).toEqual(['a']);
        expect(repeater.update(new Set(['a']), 500)).toEqual([]);
        expect(repeater.update(new Set(['a']), 549)).toEqual([]);
        expect(repeater.update(new Set(['a']), 550)).toEqual(['a']);
        expect(repeater.update(new Set(['a']), 700)).toEqual(['a']);
    });

    it('resets the delay after a release and re-press', () => {
        const repeater = new GamepadHoldRepeater<string>();
        repeater.update(new Set(['a']), 0);
        repeater.update(new Set(['a']), 400); // first repeat
        repeater.update(new Set([]), 450); // released
        expect(repeater.update(new Set(['a']), 460)).toEqual(['a']); // fresh press
        expect(repeater.update(new Set(['a']), 500)).toEqual([]); // back in the delay window
    });

    it('tracks multiple keys independently', () => {
        const repeater = new GamepadHoldRepeater<string>();
        repeater.update(new Set(['a']), 0);
        expect(repeater.update(new Set(['a', 'b']), 50)).toEqual(['b']);
        expect(repeater.update(new Set(['a', 'b']), 400)).toEqual(['a']);
        expect(repeater.update(new Set(['a', 'b']), 450)).toEqual(['b']);
    });
});

describe('GamepadEdgeTracker', () => {
    it('fires once when a key is first held', () => {
        const tracker = new GamepadEdgeTracker<string>();
        expect(tracker.update(new Set(['a']))).toEqual(['a']);
    });

    it('does not fire again while the key stays held', () => {
        const tracker = new GamepadEdgeTracker<string>();
        tracker.update(new Set(['a']));
        expect(tracker.update(new Set(['a']))).toEqual([]);
        expect(tracker.update(new Set(['a']))).toEqual([]);
    });

    it('fires again after a release and re-press', () => {
        const tracker = new GamepadEdgeTracker<string>();
        tracker.update(new Set(['a']));
        tracker.update(new Set([]));
        expect(tracker.update(new Set(['a']))).toEqual(['a']);
    });
});
