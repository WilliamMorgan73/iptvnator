import { getEpgTimestampMs } from '@iptvnator/portal/xtream/data-access';
import type { EpgItem, EpgProgram } from '@iptvnator/shared/interfaces';
import {
    computeCurrentProgramProgress,
    type TvCurrentProgramFields,
} from '@iptvnator/tv/util';

/**
 * Maps an Xtream/Stalker `EpgItem` (both portals share this shape) already
 * identified as "current" into the `TvLiveChannel` fields the channel list
 * and info overlay read. Shared by the Xtream and Stalker adapters so the
 * timestamp/progress math is written once.
 */
export function currentProgramFieldsOf(
    current: EpgItem | null,
    nowMs: number
): TvCurrentProgramFields {
    if (!current) {
        return {};
    }
    const startMs = getEpgTimestampMs(current.start, current.start_timestamp);
    const stopMs = getEpgTimestampMs(
        current.stop ?? current.end,
        current.stop_timestamp
    );
    return {
        currentProgramTitle: current.title,
        currentProgramDescription: current.description || undefined,
        currentProgramStart: current.start,
        currentProgramStop: current.stop ?? current.end,
        currentProgramProgress: computeCurrentProgramProgress(
            startMs,
            stopMs,
            nowMs
        ),
    };
}

function epgProgramTimestampMs(
    isoValue: string | undefined,
    unixSeconds: number | null | undefined
): number {
    if (Number.isFinite(unixSeconds) && Number(unixSeconds) > 0) {
        return Number(unixSeconds) * 1000;
    }
    return Date.parse(isoValue ?? '');
}

/**
 * Picks the currently-airing entry (start ≤ now < stop) out of a short
 * `EpgProgram[]` window — the shape `StalkerEpgPreviewQueue` and
 * `window.electron.getCurrentProgramsBatch` (M3U) both answer with.
 */
export function findCurrentEpgProgram(
    programs: readonly EpgProgram[],
    nowMs: number
): EpgProgram | null {
    return (
        programs.find((program) => {
            const start = epgProgramTimestampMs(
                program.start,
                program.startTimestamp
            );
            const stop = epgProgramTimestampMs(
                program.stop,
                program.stopTimestamp
            );
            return nowMs >= start && nowMs < stop;
        }) ?? null
    );
}

/** `EpgProgram` counterpart of {@link currentProgramFieldsOf}. */
export function currentProgramFieldsOfProgram(
    current: EpgProgram | null,
    nowMs: number
): TvCurrentProgramFields {
    if (!current) {
        return {};
    }
    const startMs = epgProgramTimestampMs(
        current.start,
        current.startTimestamp
    );
    const stopMs = epgProgramTimestampMs(current.stop, current.stopTimestamp);
    return {
        currentProgramTitle: current.title,
        currentProgramDescription: current.desc || undefined,
        currentProgramStart: current.start,
        currentProgramStop: current.stop,
        currentProgramProgress: computeCurrentProgramProgress(
            startMs,
            stopMs,
            nowMs
        ),
    };
}
