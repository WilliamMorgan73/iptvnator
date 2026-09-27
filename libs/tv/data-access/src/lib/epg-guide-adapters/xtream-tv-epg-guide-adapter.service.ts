import { Injectable, inject } from '@angular/core';
import { EpgRuntimeBridgeService } from '@iptvnator/epg/data-access';
import type { EpgProgram } from '@iptvnator/shared/interfaces';
import type {
    TvEpgGuideAdapter,
    TvEpgGuideChannel,
    TvEpgGuideWindow,
} from '@iptvnator/tv/util';
import { XtreamTvSourceAdapter } from '../source-adapters/xtream-tv-source-adapter.service';

interface XtreamGuidePlayRef {
    readonly epg_channel_id?: string | null;
}

/**
 * Xtream's `TvEpgGuideAdapter` — sources from the SAME XMLTV bridge bulk
 * calls the M3U adapter uses, keyed by each channel's mapped
 * `epg_channel_id` — NOT the provider's own `get_short_epg` (a separate,
 * per-channel mechanism with no bulk endpoint; fanning it out per channel
 * would mean one network call per channel for a full guide). A channel with
 * no XMLTV mapping simply renders "no programme information" — a real,
 * visible v1 gap, not a bug, matching desktop's own guide behaviour for
 * unmapped channels.
 */
@Injectable({ providedIn: 'root' })
export class XtreamTvEpgGuideAdapter implements TvEpgGuideAdapter {
    private readonly liveAdapter = inject(XtreamTvSourceAdapter);
    private readonly epgBridge = inject(EpgRuntimeBridgeService);

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
        const idsByKey = this.groupRequestedIdsByXmltvId(window.channelIds);
        const result = new Map<string, EpgProgram[]>();
        if (idsByKey.size === 0) {
            return result;
        }
        const response = await this.epgBridge.getProgramsForChannels({
            channelIds: [...idsByKey.keys()],
            fromMs: window.fromMs,
            toMs: window.toMs,
        });
        if (!response) {
            return result;
        }
        for (const [key, ids] of idsByKey) {
            const programs = response[key] ?? [];
            for (const id of ids) {
                result.set(id, programs);
            }
        }
        return result;
    }

    private groupRequestedIdsByXmltvId(
        requestedIds: readonly string[]
    ): Map<string, string[]> {
        const requested = new Set(requestedIds);
        const idsByKey = new Map<string, string[]>();
        for (const channel of this.liveAdapter.channelsAcrossCategories()) {
            if (!requested.has(channel.id)) {
                continue;
            }
            const key = (channel.playRef as XtreamGuidePlayRef).epg_channel_id;
            if (!key) {
                continue;
            }
            const ids = idsByKey.get(key) ?? [];
            ids.push(channel.id);
            idsByKey.set(key, ids);
        }
        return idsByKey;
    }
}
