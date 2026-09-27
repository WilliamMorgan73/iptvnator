import { Injectable, inject } from '@angular/core';
import { StalkerStore } from '@iptvnator/portal/stalker/data-access';
import type { EpgProgram } from '@iptvnator/shared/interfaces';
import type {
    TvEpgGuideAdapter,
    TvEpgGuideChannel,
    TvEpgGuideWindow,
} from '@iptvnator/tv/util';
import { StalkerTvSourceAdapter } from '../source-adapters/stalker-tv-source-adapter.service';

/** Requested once per guide open — matches `bulkItvEpgByChannel`'s own
 * fetch window, so a single `ensureBulkItvEpg()` call covers every day the
 * guide can step to without a second network round trip. */
const BULK_EPG_PERIOD_HOURS = 168;

/**
 * Stalker's `TvEpgGuideAdapter` — genuinely different data path from the
 * other two: `StalkerStore.bulkItvEpgByChannel()` is a real bulk 7-day grid
 * (`get_epg_info`) already cached by the store for the desktop ITV layout's
 * own guide-adjacent preview, not the XMLTV bridge the other adapters use.
 * `loadPrograms()` triggers `ensureBulkItvEpg()` best-effort (a no-op once
 * already loaded/loading) and reads whatever the cache currently has —
 * numeric entry's Stalker adapter follows the exact same
 * "best-effort background warm, read whatever is ready" pattern for its own
 * full-channel-list cache.
 */
@Injectable({ providedIn: 'root' })
export class StalkerTvEpgGuideAdapter implements TvEpgGuideAdapter {
    private readonly liveAdapter = inject(StalkerTvSourceAdapter);
    private readonly store = inject(StalkerStore);

    channels(): readonly TvEpgGuideChannel[] {
        return this.liveAdapter
            .channelsAcrossCategories()
            .map((channel, index) => ({
                id: channel.id,
                number: channel.channelNumber ?? index + 1,
                name: channel.name,
                logoUrl: channel.logoUrl ?? null,
            }));
    }

    async loadPrograms(
        window: TvEpgGuideWindow
    ): Promise<Map<string, EpgProgram[]>> {
        await this.store.ensureBulkItvEpg(BULK_EPG_PERIOD_HOURS);
        const requested = new Set(window.channelIds);
        const byChannel = this.store.bulkItvEpgByChannel();
        const result = new Map<string, EpgProgram[]>();
        for (const id of requested) {
            const programs = (byChannel[id] ?? []).filter(
                (program) =>
                    this.programOverlapsWindow(program, window) === true
            );
            if (programs.length > 0) {
                result.set(id, programs);
            }
        }
        return result;
    }

    private programOverlapsWindow(
        program: EpgProgram,
        window: TvEpgGuideWindow
    ): boolean {
        const startMs = Date.parse(program.start);
        const stopMs = Date.parse(program.stop);
        if (!Number.isFinite(startMs) || !Number.isFinite(stopMs)) {
            return false;
        }
        return startMs < window.toMs && stopMs > window.fromMs;
    }
}
