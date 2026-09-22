import { Injectable, effect, inject, signal } from '@angular/core';
import {
    StalkerEpgPreviewQueue,
    StalkerStore,
} from '@iptvnator/portal/stalker/data-access';
import { SettingsStore } from '@iptvnator/services';
import {
    epgItemToProgram,
    epgProviderClockMs,
    shortEpgWindowSize,
    type EpgProgram,
    type PlaylistMeta,
} from '@iptvnator/shared/interfaces';
import type {
    TvLiveCategory,
    TvLiveChannel,
    TvLivePlaybackResult,
    TvLiveSourceAdapter,
} from '@iptvnator/tv/util';
import {
    currentProgramFieldsOfProgram,
    findCurrentEpgProgram,
} from './epg-item-current-program.util';

/** Programmes requested per channel: current + a small safety margin, same as the desktop preview. */
const EPG_PREVIEW_FETCH_SIZE = 3;

interface StalkerTvCategory {
    readonly category_id: string;
    readonly category_name: string;
}

interface StalkerTvChannel {
    readonly id: string | number;
    readonly cmd: string;
    readonly name?: string;
    readonly o_name?: string;
    readonly logo?: string;
    readonly number?: string | number;
}

/**
 * Thin wrapper over StalkerStore. Unlike Xtream, the portal itself already
 * has a real "All" category (`category_id: '*'`) — no synthesis needed. See
 * the tv-mode plan's "Data adapters" section: categories/content are
 * resource()-backed and refetch automatically off setSelectedCategory(id).
 *
 * EPG: reuses `StalkerEpgPreviewQueue` — the same throttled, cached
 * per-channel short-EPG fetcher the desktop ITV channel list uses (see
 * `docs/architecture/stalker-portal.md`). Its `sync()` runs inside an
 * `effect()` over `itvChannels()` rather than being called imperatively from
 * `selectCategory()`: the store's content is resource-backed and refetches
 * asynchronously after `setSelectedCategory()`, so a category-selection-time
 * sync would enqueue the *previous* category's channels; reacting to the
 * signal itself always syncs whatever list is actually current, for any
 * reason it changed.
 */
@Injectable({ providedIn: 'root' })
export class StalkerTvSourceAdapter implements TvLiveSourceAdapter {
    private readonly store = inject(StalkerStore);
    private readonly settingsStore = inject(SettingsStore);

    private readonly programsByChannelId = signal<
        ReadonlyMap<string, EpgProgram[]>
    >(new Map());

    private readonly epgQueue = new StalkerEpgPreviewQueue({
        fetchPrograms: async (channelId) =>
            (
                await this.store.fetchChannelEpg(
                    channelId,
                    shortEpgWindowSize(
                        this.settingsStore.resolvedEpgOffsetMinutes(),
                        EPG_PREVIEW_FETCH_SIZE
                    )
                )
            ).map((item) => epgItemToProgram(item, channelId)),
        onPrograms: (channelId, programs) => {
            const next = new Map(this.programsByChannelId());
            next.set(String(channelId), programs);
            this.programsByChannelId.set(next);
        },
        epgOffsetMinutes: () => this.settingsStore.resolvedEpgOffsetMinutes(),
    });

    constructor() {
        effect(() => {
            this.epgQueue.sync(
                this.rawChannels().map((channel) => String(channel.id))
            );
        });
    }

    async initialize(playlist: PlaylistMeta): Promise<void> {
        await this.store.setCurrentPlaylist(playlist);
        this.store.setSelectedContentType('itv');
        this.store.preloadItvChannels();
    }

    categories(): readonly TvLiveCategory[] {
        const categories = this.store.getCategoryResource() as StalkerTvCategory[];
        return categories.map((category) => ({
            id: category.category_id,
            name: category.category_name,
        }));
    }

    selectCategory(categoryId: string): void {
        this.store.setSelectedCategory(categoryId);
    }

    channels(): readonly TvLiveChannel[] {
        const channels = this.rawChannels();
        const programsByChannelId = this.programsByChannelId();
        const nowMs = epgProviderClockMs(
            Date.now(),
            this.settingsStore.resolvedEpgOffsetMinutes()
        );
        return channels.map((channel) => {
            const id = String(channel.id);
            const programs =
                programsByChannelId.get(id) ??
                this.epgQueue.getCachedPrograms(id) ??
                [];
            const current = findCurrentEpgProgram(programs, nowMs);
            return {
                id,
                name: (channel.name || channel.o_name) as string,
                categoryId: this.store.selectedCategoryId() ?? '*',
                sourceKind: 'stalker',
                logoUrl: channel.logo || undefined,
                channelNumber: channel.number
                    ? Number(channel.number)
                    : undefined,
                playRef: channel,
                ...currentProgramFieldsOfProgram(current, nowMs),
            };
        });
    }

    private rawChannels(): readonly StalkerTvChannel[] {
        return (this.store.itvChannels() as StalkerTvChannel[]).filter(
            (channel) => Boolean(channel.name || channel.o_name)
        );
    }

    async resolvePlayback(
        channel: TvLiveChannel
    ): Promise<TvLivePlaybackResult> {
        const item = channel.playRef as StalkerTvChannel;
        const playback = await this.store.resolveItvPlayback(item);
        return {
            streamUrl: playback.streamUrl,
            userAgent: playback.userAgent,
            referer: playback.referer,
            origin: playback.origin,
            headers: playback.headers,
        };
    }
}
