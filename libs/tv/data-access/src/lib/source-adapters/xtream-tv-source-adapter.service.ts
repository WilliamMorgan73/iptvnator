import { Injectable, inject, signal } from '@angular/core';
import {
    EpgQueueService,
    XtreamCredentials,
    XtreamStore,
    findCurrentEpgItem,
} from '@iptvnator/portal/xtream/data-access';
import { SettingsStore } from '@iptvnator/services';
import {
    epgProviderClockMs,
    type EpgItem,
    type PlaylistMeta,
} from '@iptvnator/shared/interfaces';
import type {
    TvLiveCategory,
    TvLiveChannel,
    TvLivePlaybackResult,
    TvLiveSourceAdapter,
} from '@iptvnator/tv/util';
import { currentProgramFieldsOf } from './epg-item-current-program.util';

const ALL_CATEGORY_ID = 'all';

/** `XtreamStore.liveCategories()` is `(XtreamCategory | XtreamCategoryFromDb)[]`
 * — the raw-API shape (`category_id`/`category_name`) only when a fresh PWA/
 * API-only fetch hasn't round-tripped through storage yet. Electron's
 * `ElectronXtreamDataSource.getCategories()` always re-reads from SQLite
 * after caching, so in Electron this is ALWAYS the DB shape (`id`/`name`) —
 * treating it as the API shape unconditionally left every category pill
 * blank and every category filter comparing against `undefined`. */
interface XtreamTvCategory {
    readonly category_id: string;
    readonly category_name: string;
}

interface XtreamTvCategoryFromDb {
    readonly id: number;
    readonly name: string;
}

function resolveTvCategory(
    category: XtreamTvCategory | XtreamTvCategoryFromDb
): TvLiveCategory {
    if ('category_id' in category) {
        return { id: category.category_id, name: category.category_name };
    }
    return { id: String(category.id), name: category.name };
}

/** Same DB-vs-API duality as categories above: `ElectronXtreamDataSource`'s
 * `selectContentFields()` (apps/electron-backend) selects `title` and
 * `poster_url`, never `name`/`stream_icon`/`num` — so DB-sourced live
 * streams (the normal Electron path, once cached) have no `name` at all.
 * `title` is the DB row's display name; `poster_url` its artwork. */
interface XtreamTvStream {
    readonly xtream_id: number;
    readonly stream_id?: number;
    readonly num?: number;
    readonly name?: string;
    readonly title?: string;
    readonly stream_icon?: string;
    readonly poster_url?: string;
    readonly category_id?: string | number;
    readonly epg_channel_id?: string | null;
}

/**
 * Thin wrapper over XtreamStore — no changes needed to the store itself (see
 * the tv-mode plan's "Data adapters" section). `initialize()` mirrors the
 * store's own bootstrap sequence: setPlaylistId -> initialize() (DB-first
 * fetch happens internally) -> setSelectedContentType('live').
 *
 * EPG: reuses `EpgQueueService` — the same throttled, cached, provider-API-
 * first/XMLTV-fallback queue the desktop channel list uses to populate
 * "now playing" across a scrolling list — rather than building a second one.
 * `selectCategory()` enqueues the new category's streams (a command, so the
 * fetch is triggered once per category change, never from within the pure
 * `channels()` read); results arrive on `epgResult$` and are kept in a
 * signal so the shell's `computed(() => catalog.channels())` picks up the
 * update the same way it already does for `activeAdapter` changes.
 */
@Injectable({ providedIn: 'root' })
export class XtreamTvSourceAdapter implements TvLiveSourceAdapter {
    private readonly store = inject(XtreamStore);
    private readonly epgQueue = inject(EpgQueueService);
    private readonly settingsStore = inject(SettingsStore);

    private readonly epgByStreamId = signal<ReadonlyMap<number, EpgItem[]>>(
        new Map()
    );

    constructor() {
        this.epgQueue.epgResult$.subscribe(({ streamId, items }) => {
            const next = new Map(this.epgByStreamId());
            next.set(streamId, items);
            this.epgByStreamId.set(next);
        });
    }

    async initialize(playlist: PlaylistMeta): Promise<void> {
        this.store.setPlaylistId(playlist._id);
        await this.store.initialize();
        this.store.setSelectedContentType('live');
        this.store.loadRecentItems({ id: playlist._id });
    }

    categories(): readonly TvLiveCategory[] {
        const categories = this.store.liveCategories() as (
            | XtreamTvCategory
            | XtreamTvCategoryFromDb
        )[];
        return [
            { id: ALL_CATEGORY_ID, name: 'All' },
            ...categories.map(resolveTvCategory),
        ];
    }

    selectCategory(categoryId: string): void {
        this.store.setSelectedCategory(
            categoryId === ALL_CATEGORY_ID ? null : Number(categoryId)
        );
        this.enqueueEpgForCurrentCategory();
    }

    channels(): readonly TvLiveChannel[] {
        return this.toTvChannels(this.rawItems());
    }

    /** The whole playlist's live streams, ignoring the selected category —
     * `store.liveStreams()` is already the complete, unfiltered signal
     * `selectItemsFromSelectedCategory()` itself filters, so this needs no
     * extra fetch and never disturbs the currently selected category. Used
     * by numeric channel entry (`TvDigitEntryController`), not by the
     * regular channel list. */
    channelsAcrossCategories(): readonly TvLiveChannel[] {
        return this.toTvChannels(this.filterValidStreams(this.store.liveStreams()));
    }

    /** First real caller of `contentType: 'live'` in `addRecentItem` — every
     * existing call site is VOD/series. `channel.playRef` is the same
     * `XtreamTvStream` `resolvePlayback()` already reads. */
    recordRecentlyViewed(channel: TvLiveChannel): void {
        const item = channel.playRef as XtreamTvStream;
        this.store.addRecentItem({
            xtreamId: item.xtream_id,
            contentType: 'live',
            playlist: this.store.currentPlaylist,
            backdropUrl: item.stream_icon,
        });
    }

    /** Maps recently-viewed rows back to full `TvLiveChannel`s via
     * `channelsAcrossCategories()` rather than reconstructing one from the
     * sparse `RecentlyViewedItem` shape — guarantees a real, resolvable
     * `playRef` and stays consistent with whatever the catalog currently
     * has. A channel removed from the catalog since being viewed is simply
     * omitted, not an error. */
    recentChannels(): readonly TvLiveChannel[] {
        const recent = this.store
            .recentItems()
            .filter((item) => item.type === 'live');
        const byId = new Map(
            this.channelsAcrossCategories().map((channel) => [
                channel.id,
                channel,
            ])
        );
        return recent
            .map((item) => byId.get(String(item.xtream_id)))
            .filter((channel): channel is TvLiveChannel => channel !== undefined);
    }

    private toTvChannels(
        items: readonly XtreamTvStream[]
    ): readonly TvLiveChannel[] {
        const epgByStreamId = this.epgByStreamId();
        const nowMs = epgProviderClockMs(
            Date.now(),
            this.settingsStore.resolvedEpgOffsetMinutes()
        );
        return items.map((item) => {
            const epgItems =
                epgByStreamId.get(item.xtream_id) ??
                this.epgQueue.getCached(item.xtream_id) ??
                [];
            const current = findCurrentEpgItem(epgItems, nowMs);
            return {
                id: String(item.xtream_id),
                name: item.name ?? item.title ?? '',
                categoryId: String(item.category_id ?? ALL_CATEGORY_ID),
                sourceKind: 'xtream',
                logoUrl: item.stream_icon || item.poster_url || undefined,
                channelNumber: item.num,
                playRef: item,
                ...currentProgramFieldsOf(current, nowMs),
            };
        });
    }

    private rawItems(): readonly XtreamTvStream[] {
        return this.filterValidStreams(
            this.store.selectItemsFromSelectedCategory()
        );
    }

    private filterValidStreams(
        items: readonly unknown[]
    ): readonly XtreamTvStream[] {
        return items.filter(
            (item): item is XtreamTvStream & Record<string, unknown> => {
                const record = item as Record<string, unknown>;
                return (
                    typeof record['xtream_id'] === 'number' &&
                    (typeof record['name'] === 'string' ||
                        typeof record['title'] === 'string')
                );
            }
        );
    }

    private enqueueEpgForCurrentCategory(): void {
        const playlist = this.store.currentPlaylist();
        if (!playlist) {
            return;
        }
        const items = this.rawItems();
        if (items.length === 0) {
            return;
        }
        const credentials: XtreamCredentials = {
            serverUrl: playlist.serverUrl,
            username: playlist.username,
            password: playlist.password,
            serverTimezone: playlist.serverTimezone,
        };
        const entries = items.map((item) => ({
            streamId: item.xtream_id,
            epgChannelId: item.epg_channel_id ?? null,
            playlistId: playlist.id ?? null,
        }));
        const visibleIds = new Set(items.map((item) => item.xtream_id));
        void this.epgQueue
            .enqueue(entries, visibleIds, credentials)
            .catch(() => undefined);
    }

    async resolvePlayback(
        channel: TvLiveChannel
    ): Promise<TvLivePlaybackResult> {
        const item = channel.playRef as XtreamTvStream;
        const streamUrl = this.store.constructStreamUrl(item);
        const playlist = this.store.currentPlaylist();
        return {
            streamUrl,
            userAgent: playlist?.userAgent,
            referer: playlist?.referrer,
            origin: playlist?.origin,
        };
    }
}
