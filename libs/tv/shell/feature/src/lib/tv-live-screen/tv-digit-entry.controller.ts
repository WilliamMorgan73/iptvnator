import { signal } from '@angular/core';
import {
    DIGIT_ENTRY_COMMIT_TIMEOUT_MS,
    EMPTY_DIGIT_BUFFER_STATE,
    type TvDigitBufferState,
    type TvLiveChannel,
    pushDigit,
    resolveChannelByNumber,
} from '@iptvnator/tv/util';

export interface TvDigitEntryConfig {
    /** The whole active source's channels, cross-category — typing "105"
     * should find channel 105 wherever it lives, not just in whatever
     * category happens to be selected. */
    channels(): readonly TvLiveChannel[];
    onChannelResolved(channel: TvLiveChannel): void;
}

/**
 * STB-style numeric channel entry: type digits, a short pause commits the
 * jump. A separate, DI-free controller — not folded into
 * `TvLivePanesController` (already near its line-budget cap, and this needs
 * no pane/focus state of its own, only a buffer, a debounce timer, and a
 * "commit -> resolved channel" callback). Same split as `GridFocusController`
 * (pure move math) vs. this class (owns the timer) — `pushDigit`/
 * `resolveChannelByNumber` are the pure logic, independently tested in
 * `libs/tv/util`.
 *
 * Deliberately does not clear the buffer on other input (Escape, arrows,
 * etc.) — the buffer simply commits (or, if no channel matches, does
 * nothing) after its own inactivity timeout regardless of what else the user
 * does meanwhile. A real set-top box's "cancel on any other key" nuance is a
 * v2 refinement, not core to "type a number, jump to that channel."
 */
export class TvDigitEntryController {
    readonly digits = signal('');

    private state: TvDigitBufferState = EMPTY_DIGIT_BUFFER_STATE;
    private commitTimeoutId: ReturnType<typeof setTimeout> | null = null;

    constructor(private readonly config: TvDigitEntryConfig) {}

    destroy(): void {
        this.clearCommitTimer();
    }

    onDigit(digit: number): void {
        this.state = pushDigit(this.state, digit, Date.now());
        this.digits.set(this.state.digits);
        this.scheduleCommit();
    }

    private scheduleCommit(): void {
        this.clearCommitTimer();
        this.commitTimeoutId = setTimeout(
            () => this.commit(),
            DIGIT_ENTRY_COMMIT_TIMEOUT_MS
        );
    }

    private commit(): void {
        const digits = this.state.digits;
        this.state = EMPTY_DIGIT_BUFFER_STATE;
        this.digits.set('');
        this.commitTimeoutId = null;

        const channel = resolveChannelByNumber(this.config.channels(), digits);
        if (channel) {
            this.config.onChannelResolved(channel);
        }
    }

    private clearCommitTimer(): void {
        if (this.commitTimeoutId !== null) {
            clearTimeout(this.commitTimeoutId);
            this.commitTimeoutId = null;
        }
    }
}
