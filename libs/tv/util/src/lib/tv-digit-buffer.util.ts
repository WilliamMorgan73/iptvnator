/** No provider realistically needs a 5-digit channel number; caps unbounded typing. */
export const DIGIT_ENTRY_MAX_LENGTH = 4;

/** STB-style inactivity window before a typed digit string commits. */
export const DIGIT_ENTRY_COMMIT_TIMEOUT_MS = 1750;

export interface TvDigitBufferState {
    /** '' when empty. */
    readonly digits: string;
    readonly lastDigitAtMs: number;
}

export const EMPTY_DIGIT_BUFFER_STATE: TvDigitBufferState = Object.freeze({
    digits: '',
    lastDigitAtMs: 0,
});

/**
 * Pure digit-buffer transition, independent of the timer that decides WHEN
 * to commit — same split as `GridFocusController`'s pure move math vs.
 * `TvDigitEntryController`'s owned `setTimeout`. A buffer already at the max
 * length ignores further digits rather than silently dropping the oldest one
 * (a provider channel number never needs it, so this only matters for mashed
 * keys, where "stop growing" reads more predictably than "shift left").
 */
export function pushDigit(
    state: TvDigitBufferState,
    digit: number,
    nowMs: number
): TvDigitBufferState {
    if (state.digits.length >= DIGIT_ENTRY_MAX_LENGTH) {
        return state;
    }
    return {
        digits: state.digits + String(digit),
        lastDigitAtMs: nowMs,
    };
}
