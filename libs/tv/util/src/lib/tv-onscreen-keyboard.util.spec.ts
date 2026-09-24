import {
    resolveTvKeyboardChar,
    resolveTvKeyboardKeyLabel,
    TV_KEYBOARD_COLUMNS,
    TV_KEYBOARD_LAYOUT,
} from './tv-onscreen-keyboard.util';

describe('tv-onscreen-keyboard.util', () => {
    it('is a perfectly rectangular grid — GridFocusController requires uniform columns', () => {
        expect(TV_KEYBOARD_LAYOUT.length % TV_KEYBOARD_COLUMNS).toBe(0);
        expect(TV_KEYBOARD_LAYOUT.length).toBe(50);
    });

    it('contains every digit and letter exactly once', () => {
        const chars = TV_KEYBOARD_LAYOUT.filter(
            (key): key is Extract<(typeof TV_KEYBOARD_LAYOUT)[number], { kind: 'char' }> =>
                key.kind === 'char'
        ).map((key) => key.char);

        for (const digit of '1234567890') {
            expect(chars.filter((char) => char === digit)).toHaveLength(1);
        }
        for (const letter of 'abcdefghijklmnopqrstuvwxyz') {
            expect(chars.filter((char) => char === letter)).toHaveLength(1);
        }
    });

    it('contains exactly one shift, space, backspace and done key', () => {
        for (const kind of ['shift', 'space', 'backspace', 'done'] as const) {
            expect(
                TV_KEYBOARD_LAYOUT.filter((key) => key.kind === kind)
            ).toHaveLength(1);
        }
    });

    describe('resolveTvKeyboardKeyLabel', () => {
        it('shows the lowercase char when shift is off', () => {
            expect(
                resolveTvKeyboardKeyLabel({ kind: 'char', char: 'q', shiftedChar: 'Q' }, false)
            ).toBe('q');
        });

        it('shows the shifted char when shift is on', () => {
            expect(
                resolveTvKeyboardKeyLabel({ kind: 'char', char: 'q', shiftedChar: 'Q' }, true)
            ).toBe('Q');
        });

        it('is unaffected by shift for a char with no shiftedChar (digits/symbols)', () => {
            expect(resolveTvKeyboardKeyLabel({ kind: 'char', char: '1' }, true)).toBe('1');
        });

        it('labels control keys regardless of shift state', () => {
            expect(resolveTvKeyboardKeyLabel({ kind: 'space' }, true)).toBe('Space');
            expect(resolveTvKeyboardKeyLabel({ kind: 'backspace' }, false)).toBe('⌫');
            expect(resolveTvKeyboardKeyLabel({ kind: 'shift' }, false)).toBe('Shift');
            expect(resolveTvKeyboardKeyLabel({ kind: 'done' }, false)).toBe('Done');
        });
    });

    describe('resolveTvKeyboardChar', () => {
        it('emits the lowercase char when shift is off, uppercase when on', () => {
            const key = { kind: 'char', char: 'a', shiftedChar: 'A' } as const;
            expect(resolveTvKeyboardChar(key, false)).toBe('a');
            expect(resolveTvKeyboardChar(key, true)).toBe('A');
        });

        it('emits a literal space for the space key', () => {
            expect(resolveTvKeyboardChar({ kind: 'space' }, false)).toBe(' ');
        });

        it('returns null for backspace/shift/done — the host handles those itself', () => {
            expect(resolveTvKeyboardChar({ kind: 'backspace' }, false)).toBeNull();
            expect(resolveTvKeyboardChar({ kind: 'shift' }, false)).toBeNull();
            expect(resolveTvKeyboardChar({ kind: 'done' }, false)).toBeNull();
        });
    });
});
