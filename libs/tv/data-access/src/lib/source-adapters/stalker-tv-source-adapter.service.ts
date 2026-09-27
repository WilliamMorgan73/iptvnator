import { Injectable, effect, inject, signal } from '@angular/core';
import {
    StalkerEpgPreviewQueue,
    StalkerItvCacheService,
    StalkerStore,
} from '@iptvnator/portal/stalker/data-access';
import { PlaylistsService, SettingsStore } from '@iptvnator/services';
import {
    epgItemToProgram,
    epgProviderClockMs,
    extractStalkerItemType,
    shortEpgWindowSize,
    type EpgProgram,
    type PlaylistMeta,
    type StalkerPortalItem,
} from '@iptvnator/shared/interfaces';
import { firstValueFrom } from 'rxjs';
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
    /** Present on real portal items; used to attribute a cross-category
     * cache entry (`channelsAcrossCategories()`) to its real category. */
    readonly tv_genre_id?: string | number;
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
    private readonly itvCache = inject(StalkerItvCacheService);
    private readonly playlistsService = inject(PlaylistsService);
    private playlist: PlaylistMeta | undefined;

    /** Most-recent-first ITV channel ids, refreshed after every write —
     * `getPortalRecentlyViewed` returns an Observable over a DB read, so this
     * caches the last read for the synchronous `recentChannels()`. */
    private readonly recentChannelIds = signal<readonly string[]>([]);

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
        this.playlist = playlist;
        await this.store.setCurrentPlaylist(playlist);
        this.store.setSelectedContentType('itv');
        this.store.preloadItvChannels();
        // Best-effort background warm for channelsAcrossCategories() —
        // no-ops if already loaded/loading/unsupported for this portal, and
        // numeric channel entry falls back to the current category's
        // channels until it settles.
        void this.itvCache.ensureLoaded(playlist);
        void this.refreshRecentChannelIds();
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
        return this.toTvChannels(this.rawChannels());
    }

    /** The whole portal's ITV channels, ignoring the selected category —
     * sourced from `StalkerItvCacheService`'s background-loaded full list
     * (see `initialize()`), since `itvChannels()` itself is tied to
     * `setSelectedCategory()` and switching it would disturb the category
     * the user is currently browsing. Falls back to the current category's
     * channels while the cache hasn't finished loading yet (or the portal
     * doesn't support a bulk fetch) — numeric entry then just can't find a
     * channel outside it until the cache settles. */
    channelsAcrossCategories(): readonly TvLiveChannel[] {
        const cached = this.itvCache.getChannels(this.playlist);
        return this.toTvChannels(
            (cached as StalkerTvChannel[] | null) ?? this.rawChannels()
        );
    }

    private toTvChannels(
        channels: readonly StalkerTvChannel[]
    ): readonly TvLiveChannel[] {
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
                categoryId: String(
                    channel.tv_genre_id ??
                        this.store.selectedCategoryId() ??
                        '*'
                ),
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

    /** Persists a confirmed activation to the same `playlists.recently_viewed`
     * blob column desktop's own ITV playback writes to (`resolveItvPlayback`'s
     * counterpart, `with-stalker-player.feature.ts`'s `recordRecentlyViewed`)
     * — reused here without that feature's NgRx-dispatch side effect, since
     * tv mode has no connected desktop UI to notify. `category_id` is set to
     * the channel's own `tv_genre_id` when known, else the literal `'itv'`
     * fallback `extractStalkerItemType()` also recognizes on read. */
    recordRecentlyViewed(channel: TvLiveChannel): void {
        const item = channel.playRef as StalkerTvChannel;
        const playlistId = this.playlist?._id;
        if (!playlistId) {
            return;
        }
        const recentItem: StalkerPortalItem & {
            id: string | number;
            title: string;
        } = {
            ...item,
            id: String(item.id),
            title: (item.name || item.o_name) ?? '',
            category_id: String(item.tv_genre_id ?? 'itv'),
            added_at: Date.now(),
        };
        this.playlistsService
            .addPortalRecentlyViewed(playlistId, recentItem)
            .subscribe(() => void this.refreshRecentChannelIds());
    }

    /** Maps cached recent ids back to full `TvLiveChannel`s via
     * `channelsAcrossCategories()`, same reasoning as the Xtream adapter — a
     * real, resolvable `playRef` beats reconstructing one from the sparse
     * persisted shape, and a channel removed from the catalog since being
     * viewed is simply omitted. */
    recentChannels(): readonly TvLiveChannel[] {
        const ids = this.recentChannelIds();
        const byId = new Map(
            this.channelsAcrossCategories().map((channel) => [
                channel.id,
                channel,
            ])
        );
        return ids
            .map((id) => byId.get(id))
            .filter((channel): channel is TvLiveChannel => channel !== undefined);
    }

    private async refreshRecentChannelIds(): Promise<void> {
        const playlistId = this.playlist?._id;
        if (!playlistId) {
            return;
        }
        const items = await firstValueFrom(
            this.playlistsService.getPortalRecentlyViewed(playlistId)
        );
        this.recentChannelIds.set(
            items
                .filter((item) => extractStalkerItemType(item) === 'live')
                .map((item) => String(item.id))
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
