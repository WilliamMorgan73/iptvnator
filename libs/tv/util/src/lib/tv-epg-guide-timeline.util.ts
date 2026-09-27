/** Percentage-based position/width for one programme block within the
 * guide's current day window — Angular/DOM-free so it belongs in `util`,
 * consumed by `TvEpgGuideRowComponent`'s inline `[style.left.%]`/
 * `[style.width.%]` bindings. */
export interface TvEpgGuideBlockLayout {
    readonly leftPercent: number;
    readonly widthPercent: number;
}

/** A programme narrower than this on-screen would be an unreadable sliver —
 * floor it so a very short programme (a 5-minute news brief) still reads as
 * a real block rather than a hairline. */
const MIN_BLOCK_WIDTH_PERCENT = 2;

/**
 * Clamps a programme's [start, stop) to the requested window and expresses
 * it as a percentage of that window's width — `null` when the programme
 * doesn't actually overlap the window (a defensive check; adapters are
 * expected to have already filtered to overlapping programmes, but a block
 * that clips to nothing must never render a negative or zero-width bar).
 */
export function computeEpgGuideBlockLayout(
    program: { readonly start: string; readonly stop: string },
    windowFromMs: number,
    windowToMs: number
): TvEpgGuideBlockLayout | null {
    const startMs = Date.parse(program.start);
    const stopMs = Date.parse(program.stop);
    if (
        !Number.isFinite(startMs) ||
        !Number.isFinite(stopMs) ||
        stopMs <= startMs ||
        windowToMs <= windowFromMs
    ) {
        return null;
    }
    const clampedStartMs = Math.max(startMs, windowFromMs);
    const clampedStopMs = Math.min(stopMs, windowToMs);
    if (clampedStopMs <= clampedStartMs) {
        return null;
    }
    const totalMs = windowToMs - windowFromMs;
    const leftPercent = ((clampedStartMs - windowFromMs) / totalMs) * 100;
    const widthPercent = Math.max(
        MIN_BLOCK_WIDTH_PERCENT,
        ((clampedStopMs - clampedStartMs) / totalMs) * 100
    );
    return { leftPercent, widthPercent };
}

/** Horizontal position of "now" within the window, as a percentage — `null`
 * when now falls outside the window (viewing a different day). */
export function computeEpgGuideNowPercent(
    nowMs: number,
    windowFromMs: number,
    windowToMs: number
): number | null {
    if (
        windowToMs <= windowFromMs ||
        nowMs < windowFromMs ||
        nowMs > windowToMs
    ) {
        return null;
    }
    return ((nowMs - windowFromMs) / (windowToMs - windowFromMs)) * 100;
}
