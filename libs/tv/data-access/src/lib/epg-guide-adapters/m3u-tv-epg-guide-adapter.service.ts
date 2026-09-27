import { Injectable, inject } from '@angular/core';
import { EpgRuntimeBridgeService } from '@iptvnator/epg/data-access';
import { resolveChannelEpgLookupKey } from '@iptvnator/m3u-state';
import type { Channel, EpgProgram } from '@iptvnator/shared/interfaces';
import type {
    TvEpgGuideAdapter,
    TvEpgGuideChannel,
    TvEpgGuideWindow,
} from '@iptvnator/tv/util';
import { M3uTvSourceAdapter } from '../source-adapters/m3u-tv-source-adapter.service';

/**
 * M3U's `TvEpgGuideAdapter` — reuses `M3uTvSourceAdapter.channelsAcrossCategories()`
 * for the channel list (no separate NgRx subscription duplicated here) and
 * the same XMLTV bridge bulk calls (`EpgRuntimeBridgeService`) desktop's own
 * M3U guide uses, keyed by `resolveChannelEpgLookupKey()` (tvg-id, falling
 * back to name) — the same lookup chain the tv-mode live adapter's "now
 * playing" row already uses. This is a deliberately small, DUPLICATED
 * adapter rather than a shared lib: the only existing `EpgGuideSource`
 * implementation lives in `libs/playlist/m3u/feature-player`
 * (type:feature-player), a project `libs/tv/data-access` (type:data-access)
 * cannot depend on, and the generic bits worth sharing (XMLTV lookup-key
 * resolution) already live in `@iptvnator/m3u-state`. See
 * `docs/architecture/nx-workspace-boundaries.md`.
 */
@Injectable({ providedIn: 'root' })
export class M3uTvEpgGuideAdapter implements TvEpgGuideAdapter {
    private readonly liveAdapter = inject(M3uTvSourceAdapter);
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
        const idsByKey = this.groupRequestedIdsByLookupKey(window.channelIds);
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

    private groupRequestedIdsByLookupKey(
        requestedIds: readonly string[]
    ): Map<string, string[]> {
        const requested = new Set(requestedIds);
        const idsByKey = new Map<string, string[]>();
        for (const channel of this.liveAdapter.channelsAcrossCategories()) {
            if (!requested.has(channel.id)) {
                continue;
            }
            const key = resolveChannelEpgLookupKey(channel.playRef as Channel);
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
