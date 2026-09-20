import { Injectable, inject } from '@angular/core';
import { StalkerStore } from '@iptvnator/portal/stalker/data-access';
import type { PlaylistMeta } from '@iptvnator/shared/interfaces';
import type {
    TvLiveCategory,
    TvLiveChannel,
    TvLivePlaybackResult,
    TvLiveSourceAdapter,
} from '@iptvnator/tv/util';

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
 */
@Injectable({ providedIn: 'root' })
export class StalkerTvSourceAdapter implements TvLiveSourceAdapter {
    private readonly store = inject(StalkerStore);

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
        const channels = this.store.itvChannels() as StalkerTvChannel[];
        return channels
            .filter((channel) => Boolean(channel.name || channel.o_name))
            .map((channel) => ({
                id: String(channel.id),
                name: (channel.name || channel.o_name) as string,
                categoryId: this.store.selectedCategoryId() ?? '*',
                sourceKind: 'stalker',
                logoUrl: channel.logo || undefined,
                channelNumber: channel.number
                    ? Number(channel.number)
                    : undefined,
                playRef: channel,
            }));
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
