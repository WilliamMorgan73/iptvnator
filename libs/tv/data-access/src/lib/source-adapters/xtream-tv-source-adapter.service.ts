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

interface XtreamTvCategory {
    readonly category_id: string;
    readonly category_name: string;
}

interface XtreamTvStream {
    readonly xtream_id: number;
    readonly stream_id?: number;
    readonly num?: number;
    readonly name: string;
    readonly stream_icon?: string;
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
    }

    categories(): readonly TvLiveCategory[] {
        const categories = this.store.liveCategories() as XtreamTvCategory[];
        return [
            { id: ALL_CATEGORY_ID, name: 'All' },
            ...categories.map((category) => ({
                id: category.category_id,
                name: category.category_name,
            })),
        ];
    }

    selectCategory(categoryId: string): void {
        this.store.setSelectedCategory(
            categoryId === ALL_CATEGORY_ID ? null : Number(categoryId)
        );
        this.enqueueEpgForCurrentCategory();
    }

    channels(): readonly TvLiveChannel[] {
        const items = this.rawItems();
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
                name: item.name,
                categoryId: String(item.category_id ?? ALL_CATEGORY_ID),
                sourceKind: 'xtream',
                logoUrl: item.stream_icon || undefined,
                channelNumber: item.num,
                playRef: item,
                ...currentProgramFieldsOf(current, nowMs),
            };
        });
    }

    private rawItems(): readonly XtreamTvStream[] {
        return this.store
            .selectItemsFromSelectedCategory()
            .filter(
                (item): item is XtreamTvStream & Record<string, unknown> =>
                    typeof item['xtream_id'] === 'number' &&
                    typeof item['name'] === 'string'
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
