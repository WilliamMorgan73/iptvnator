export type TvKeyboardKey =
    | { kind: 'char'; char: string; shiftedChar?: string }
    | { kind: 'space' }
    | { kind: 'backspace' }
    | { kind: 'shift' }
    | { kind: 'done' };

function charKey(char: string, shiftedChar?: string): TvKeyboardKey {
    return { kind: 'char', char, shiftedChar };
}

/** 10 columns × 5 rows — every key the same size, no CSS spanning tricks,
 * so `GridFocusController`'s rectangular-grid assumption stays trivially
 * true. Covers digits, all 26 letters, MAC/URL-relevant `. - _ : / @`, and a
 * few password symbols. Shift is a sticky case toggle, not one-shot — easier
 * to type a whole uppercase password with a D-pad than re-selecting Shift
 * before every character. */
export const TV_KEYBOARD_COLUMNS = 10;

function letterRow(letters: string): TvKeyboardKey[] {
    return letters
        .split('')
        .map((char) => charKey(char, char.toUpperCase()));
}

export const TV_KEYBOARD_LAYOUT: readonly TvKeyboardKey[] = [
    // Row 1: digits
    ...'1234567890'.split('').map((char) => charKey(char)),
    // Row 2: letters
    ...letterRow('qwertyuiop'),
    // Row 3: letters (home row + z, to keep the row 10 wide)
    ...letterRow('asdfghjklz'),
    // Row 4: letters + URL/MAC punctuation
    ...letterRow('xcvbnm'),
    charKey('.'),
    charKey('-'),
    charKey('_'),
    charKey(':'),
    // Row 5: remaining symbols + control keys
    charKey('/'),
    charKey('@'),
    charKey('!'),
    charKey('#'),
    charKey('$'),
    charKey('='),
    { kind: 'shift' },
    { kind: 'space' },
    { kind: 'backspace' },
    { kind: 'done' },
];

export function resolveTvKeyboardKeyLabel(
    key: TvKeyboardKey,
    shiftActive: boolean
): string {
    switch (key.kind) {
        case 'char':
            return shiftActive ? (key.shiftedChar ?? key.char) : key.char;
        case 'space':
            return 'Space';
        case 'backspace':
            return '⌫';
        case 'shift':
            return 'Shift';
        case 'done':
            return 'Done';
    }
}

/** The character activating this key inserts, or `null` for a control key
 * (backspace/shift/done) the host handles itself instead of emitting text. */
export function resolveTvKeyboardChar(
    key: TvKeyboardKey,
    shiftActive: boolean
): string | null {
    switch (key.kind) {
        case 'char':
            return shiftActive ? (key.shiftedChar ?? key.char) : key.char;
        case 'space':
            return ' ';
        case 'backspace':
        case 'shift':
        case 'done':
            return null;
    }
}
