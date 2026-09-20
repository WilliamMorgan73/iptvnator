import { Injectable, inject, signal } from '@angular/core';
import { PlaylistsService } from '@iptvnator/services';
import type { PlaylistMeta } from '@iptvnator/shared/interfaces';
import {
    resolveTvLiveSourceKind,
    type TvLiveCategory,
    type TvLiveChannel,
    type TvLivePlaybackResult,
    type TvLiveSourceAdapter,
} from '@iptvnator/tv/util';
import { firstValueFrom } from 'rxjs';
import { M3uTvSourceAdapter } from './source-adapters/m3u-tv-source-adapter.service';
import { StalkerTvSourceAdapter } from './source-adapters/stalker-tv-source-adapter.service';
import { XtreamTvSourceAdapter } from './source-adapters/xtream-tv-source-adapter.service';

export type TvLiveCatalogStatus =
    | 'loading'
    | 'ready'
    | 'no-playlists'
    | 'error';

/**
 * Picks the adapter for the active playlist — the only thing
 * `libs/tv/shell/feature` talks to (tv-mode plan, "Data adapters"). v1 has
 * no source-switcher UI, so it drives the one screen from the FIRST playlist
 * `PlaylistsService.getAllPlaylists()` returns; a proper picker is future
 * work, not v1 scope.
 */
@Injectable({ providedIn: 'root' })
export class TvLiveCatalogFacade {
    private readonly playlistsService = inject(PlaylistsService);
    private readonly xtreamAdapter = inject(XtreamTvSourceAdapter);
    private readonly stalkerAdapter = inject(StalkerTvSourceAdapter);
    private readonly m3uAdapter = inject(M3uTvSourceAdapter);

    private readonly activeAdapter = signal<TvLiveSourceAdapter | null>(null);

    readonly status = signal<TvLiveCatalogStatus>('loading');
    readonly playlistTitle = signal<string | null>(null);

    async initialize(): Promise<void> {
        this.status.set('loading');
        this.activeAdapter.set(null);
        this.playlistTitle.set(null);

        let playlists: readonly PlaylistMeta[];
        try {
            playlists = await firstValueFrom(
                this.playlistsService.getAllPlaylists()
            );
        } catch {
            this.status.set('error');
            return;
        }

        if (playlists.length === 0) {
            this.status.set('no-playlists');
            return;
        }

        const playlist = playlists[0];
        const adapter = this.adapterFor(playlist);
        try {
            await adapter.initialize(playlist);
        } catch {
            this.status.set('error');
            return;
        }

        this.activeAdapter.set(adapter);
        this.playlistTitle.set(playlist.title);
        this.status.set('ready');
    }

    categories(): readonly TvLiveCategory[] {
        return this.activeAdapter()?.categories() ?? [];
    }

    selectCategory(categoryId: string): void {
        this.activeAdapter()?.selectCategory(categoryId);
    }

    channels(): readonly TvLiveChannel[] {
        return this.activeAdapter()?.channels() ?? [];
    }

    async resolvePlayback(
        channel: TvLiveChannel
    ): Promise<TvLivePlaybackResult> {
        const adapter = this.activeAdapter();
        if (!adapter) {
            throw new Error('No active tv-mode source');
        }
        return adapter.resolvePlayback(channel);
    }

    private adapterFor(playlist: PlaylistMeta): TvLiveSourceAdapter {
        switch (resolveTvLiveSourceKind(playlist)) {
            case 'xtream':
                return this.xtreamAdapter;
            case 'stalker':
                return this.stalkerAdapter;
            case 'm3u':
                return this.m3uAdapter;
        }
    }
}
