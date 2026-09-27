import type { GridFocusDirection } from './grid-focus.controller';

export type TvGamepadAction =
    | { kind: 'direction'; direction: GridFocusDirection }
    | { kind: 'activate' }
    | { kind: 'back' }
    | { kind: 'categoryStep'; direction: 'previous' | 'next' }
    | { kind: 'toggleSources' }
    | { kind: 'toggleInfo' }
    | { kind: 'openSettings' }
    | { kind: 'toggleRecent' }
    | { kind: 'toggleRecord' }
    | { kind: 'toggleRecordingsList' }
    | { kind: 'openGuide' };

/**
 * Standard gamepad mapping (https://w3c.github.io/gamepad/#remapping):
 * D-pad = buttons 12-15, A = 0, B = 1, LB/L1 = 4, RB/R1 = 5, X = 2, Y = 3,
 * Back/Select = 8, Start = 9. LB/RB flip categories directly rather than
 * moving into the pills pane first — the same "quick channel-group flip"
 * gesture as many TV/set-top apps. Back/Select opens the source-switcher
 * panel, Y toggles the channel-info overlay, Start opens Settings, X opens
 * Recently Viewed, RT/R2 starts/stops recording whatever is playing, left
 * stick click opens/closes the Recordings list, LT/L2 opens the full guide —
 * button 11 (right stick click) remains unused. No gamepad digit entry in v1
 * (most gamepads have no numeric buttons) — see
 * `TvKeyboardInputDirective.digit`, keyboard-only.
 */
export const GAMEPAD_BUTTON_ACTIONS: ReadonlyMap<number, TvGamepadAction> =
    new Map([
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
        [2, { kind: 'toggleRecent' }],
        [7, { kind: 'toggleRecord' }],
        [10, { kind: 'toggleRecordingsList' }],
        [6, { kind: 'openGuide' }],
    ]);

/** Buttons that hold-to-repeat (movement); activate/back are one-shot only. */
export const GAMEPAD_REPEATABLE_BUTTONS: ReadonlySet<number> = new Set([
    12, 13, 14, 15, 4, 5,
]);

export const GAMEPAD_STICK_DEADZONE = 0.5;

/** Left-stick axes (0, 1) into a direction, or null while inside the deadzone. */
export function resolveGamepadStickDirection(
    x: number,
    y: number,
    deadzone: number = GAMEPAD_STICK_DEADZONE
): GridFocusDirection | null {
    if (Math.abs(x) < deadzone && Math.abs(y) < deadzone) {
        return null;
    }
    if (Math.abs(x) > Math.abs(y)) {
        return x > 0 ? 'right' : 'left';
    }
    return y > 0 ? 'down' : 'up';
}
