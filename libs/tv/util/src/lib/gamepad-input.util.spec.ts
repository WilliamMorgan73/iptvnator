import {
    GAMEPAD_BUTTON_ACTIONS,
    GAMEPAD_REPEATABLE_BUTTONS,
    resolveGamepadStickDirection,
} from './gamepad-input.util';

describe('GAMEPAD_BUTTON_ACTIONS', () => {
    it.each([
        [12, { kind: 'direction', direction: 'up' }],
        [13, { kind: 'direction', direction: 'down' }],
        [14, { kind: 'direction', direction: 'left' }],
        [15, { kind: 'direction', direction: 'right' }],
        [0, { kind: 'activate' }],
        [1, { kind: 'back' }],
        [4, { kind: 'categoryStep', direction: 'previous' }],
        [5, { kind: 'categoryStep', direction: 'next' }],
        [8, { kind: 'toggleSources' }],
        [3, { kind: 'toggleInfo' }],
        [9, { kind: 'openSettings' }],
    ])('maps button %s', (index, expected) => {
        expect(GAMEPAD_BUTTON_ACTIONS.get(index as number)).toEqual(expected);
    });

    it('has no mapping for an unused button index', () => {
        expect(GAMEPAD_BUTTON_ACTIONS.get(2)).toBeUndefined();
    });
});

describe('GAMEPAD_REPEATABLE_BUTTONS', () => {
    it('marks the d-pad and shoulder buttons repeatable', () => {
        expect([...GAMEPAD_REPEATABLE_BUTTONS].sort((a, b) => a - b)).toEqual(
            [4, 5, 12, 13, 14, 15]
        );
    });

    it('does not mark activate/back repeatable', () => {
        expect(GAMEPAD_REPEATABLE_BUTTONS.has(0)).toBe(false);
        expect(GAMEPAD_REPEATABLE_BUTTONS.has(1)).toBe(false);
    });
});

describe('resolveGamepadStickDirection', () => {
    it('returns null inside the deadzone', () => {
        expect(resolveGamepadStickDirection(0.1, -0.2)).toBeNull();
        expect(resolveGamepadStickDirection(0, 0)).toBeNull();
    });

    it.each([
        [1, 0, 'right'],
        [-1, 0, 'left'],
        [0, 1, 'down'],
        [0, -1, 'up'],
    ])('resolves axes (%s, %s) to %s', (x, y, expected) => {
        expect(resolveGamepadStickDirection(x, y)).toBe(expected);
    });

    it('picks the dominant axis on a diagonal tilt', () => {
        expect(resolveGamepadStickDirection(0.9, 0.3)).toBe('right');
        expect(resolveGamepadStickDirection(0.3, 0.9)).toBe('down');
    });

    it('respects a custom deadzone', () => {
        expect(resolveGamepadStickDirection(0.6, 0, 0.7)).toBeNull();
        expect(resolveGamepadStickDirection(0.8, 0, 0.7)).toBe('right');
    });
});
