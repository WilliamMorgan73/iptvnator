import { Injectable, inject } from '@angular/core';
import { XtreamStore } from '@iptvnator/portal/xtream/data-access';
import type { PlaylistMeta } from '@iptvnator/shared/interfaces';
import type {
    TvLiveCategory,
    TvLiveChannel,
    TvLivePlaybackResult,
    TvLiveSourceAdapter,
} from '@iptvnator/tv/util';

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
}

/**
 * Thin wrapper over XtreamStore — no changes needed to the store itself (see
 * the tv-mode plan's "Data adapters" section). `initialize()` mirrors the
 * store's own bootstrap sequence: setPlaylistId -> initialize() (DB-first
 * fetch happens internally) -> setSelectedContentType('live').
 */
@Injectable({ providedIn: 'root' })
export class XtreamTvSourceAdapter implements TvLiveSourceAdapter {
    private readonly store = inject(XtreamStore);

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
    }

    channels(): readonly TvLiveChannel[] {
        const items = this.store
            .selectItemsFromSelectedCategory()
            .filter(
                (item): item is XtreamTvStream & Record<string, unknown> =>
                    typeof item['xtream_id'] === 'number' &&
                    typeof item['name'] === 'string'
            );
        return items.map((item) => ({
            id: String(item.xtream_id),
            name: item.name,
            categoryId: String(item.category_id ?? ALL_CATEGORY_ID),
            sourceKind: 'xtream',
            logoUrl: item.stream_icon || undefined,
            channelNumber: item.num,
            playRef: item,
        }));
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
