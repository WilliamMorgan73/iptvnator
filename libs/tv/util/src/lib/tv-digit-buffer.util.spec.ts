import {
    DIGIT_ENTRY_MAX_LENGTH,
    EMPTY_DIGIT_BUFFER_STATE,
    pushDigit,
} from './tv-digit-buffer.util';

describe('pushDigit', () => {
    it('appends a digit and records the timestamp', () => {
        const state = pushDigit(EMPTY_DIGIT_BUFFER_STATE, 1, 1000);

        expect(state).toEqual({ digits: '1', lastDigitAtMs: 1000 });
    });

    it('accumulates digits in order across calls', () => {
        let state = pushDigit(EMPTY_DIGIT_BUFFER_STATE, 1, 1000);
        state = pushDigit(state, 0, 1200);
        state = pushDigit(state, 5, 1400);

        expect(state.digits).toBe('105');
        expect(state.lastDigitAtMs).toBe(1400);
    });

    it('stops growing at the max length instead of dropping the oldest digit', () => {
        let state = EMPTY_DIGIT_BUFFER_STATE;
        for (let i = 0; i < DIGIT_ENTRY_MAX_LENGTH; i++) {
            state = pushDigit(state, i, 1000 + i);
        }
        expect(state.digits.length).toBe(DIGIT_ENTRY_MAX_LENGTH);

        const overflowed = pushDigit(state, 9, 9999);

        expect(overflowed).toBe(state); // same reference: a true no-op
        expect(overflowed.digits).toBe(state.digits);
    });
});
