import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ChannelActions, selectChannels } from '@iptvnator/m3u-state';
import { PlaylistsService } from '@iptvnator/services';
import type { Channel, PlaylistMeta } from '@iptvnator/shared/interfaces';
import { Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';
import type {
    TvLiveCategory,
    TvLiveChannel,
    TvLivePlaybackResult,
    TvLiveSourceAdapter,
} from '@iptvnator/tv/util';

const ALL_CATEGORY_ID = 'all';
const UNGROUPED_CATEGORY_ID = 'ungrouped';

/**
 * M3U has no per-source store — the tv-mode plan's "Data adapters" section
 * has this replicate the 3 lines `M3uWorkspaceRouteSession` uses to load a
 * playlist's channels into `libs/m3u-state`, rather than dispatching
 * `setActiveChannel` (which can auto-launch an external player per user
 * settings — v1's in-app-only player must avoid that). Categories don't
 * exist for M3U; they're grouped client-side from `channel.group.title`,
 * since no such selector exists upstream.
 */
@Injectable({ providedIn: 'root' })
export class M3uTvSourceAdapter implements TvLiveSourceAdapter {
    private readonly store = inject(Store);
    private readonly playlistsService = inject(PlaylistsService);
    private readonly allChannels = toSignal(this.store.select(selectChannels), {
        initialValue: [] as Channel[],
    });
    private readonly selectedCategoryId = signal(ALL_CATEGORY_ID);

    private readonly categoryNames = computed(() => {
        const names = new Set<string>();
        for (const channel of this.allChannels()) {
            const title = channel.group?.title?.trim();
            if (title) {
                names.add(title);
            }
        }
        return [...names].sort((a, b) => a.localeCompare(b));
    });

    async initialize(playlist: PlaylistMeta): Promise<void> {
        const full = await firstValueFrom(
            this.playlistsService.getPlaylist(playlist._id)
        );
        const channels = (full.playlist?.items ?? []) as Channel[];
        this.store.dispatch(ChannelActions.setChannels({ channels }));
        this.selectedCategoryId.set(ALL_CATEGORY_ID);
    }

    categories(): readonly TvLiveCategory[] {
        const hasUngrouped = this.allChannels().some(
            (channel) => !channel.group?.title?.trim()
        );
        return [
            { id: ALL_CATEGORY_ID, name: 'All' },
            ...this.categoryNames().map((name) => ({ id: name, name })),
            ...(hasUngrouped
                ? [{ id: UNGROUPED_CATEGORY_ID, name: 'Ungrouped' }]
                : []),
        ];
    }

    selectCategory(categoryId: string): void {
        this.selectedCategoryId.set(categoryId);
    }

    channels(): readonly TvLiveChannel[] {
        const categoryId = this.selectedCategoryId();
        return this.allChannels()
            .filter((channel) => this.matchesCategory(channel, categoryId))
            .map((channel, index) => ({
                id: channel.id || channel.url || String(index),
                name: channel.name,
                categoryId: channel.group?.title?.trim() || UNGROUPED_CATEGORY_ID,
                sourceKind: 'm3u',
                logoUrl: channel.tvg?.logo || undefined,
                playRef: channel,
            }));
    }

    private matchesCategory(channel: Channel, categoryId: string): boolean {
        if (categoryId === ALL_CATEGORY_ID) {
            return true;
        }
        const title = channel.group?.title?.trim();
        if (categoryId === UNGROUPED_CATEGORY_ID) {
            return !title;
        }
        return title === categoryId;
    }

    async resolvePlayback(
        channel: TvLiveChannel
    ): Promise<TvLivePlaybackResult> {
        const item = channel.playRef as Channel;
        return {
            streamUrl: item.url,
            userAgent: item.http?.['user-agent'] || undefined,
            referer: item.http?.referrer || undefined,
            origin: item.http?.origin || undefined,
        };
    }
}
