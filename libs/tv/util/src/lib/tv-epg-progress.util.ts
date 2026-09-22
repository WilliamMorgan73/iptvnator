/**
 * The subset of `TvLiveChannel` that describes the channel's current
 * programme — shared by all three source adapters so each only has to map
 * its own EPG item shape (Xtream/Stalker `EpgItem`, M3U's `EpgProgram`) into
 * one place, and by `TvChannelInfoOverlayComponent`.
 */
export interface TvCurrentProgramFields {
    readonly currentProgramTitle?: string;
    readonly currentProgramDescription?: string;
    readonly currentProgramStart?: string;
    readonly currentProgramStop?: string;
    readonly currentProgramProgress?: number;
}

/**
 * Elapsed fraction (0–1) of a programme given its start/stop instants and
 * the current clock, all in epoch milliseconds. `undefined` when the window
 * is degenerate (stop not after start) — never a divide-by-zero NaN that
 * would silently render a broken progress bar.
 */
export function computeCurrentProgramProgress(
    startMs: number,
    stopMs: number,
    nowMs: number
): number | undefined {
    if (!(stopMs > startMs)) {
        return undefined;
    }
    const fraction = (nowMs - startMs) / (stopMs - startMs);
    return Math.min(1, Math.max(0, fraction));
}
