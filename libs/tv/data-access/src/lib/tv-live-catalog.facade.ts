import { Injectable, inject, signal } from '@angular/core';
import { PlaylistsService } from '@iptvnator/services';
import type { PlaylistMeta } from '@iptvnator/shared/interfaces';
import {
    resolveTvLiveSourceKind,
    type TvLiveCategory,
    type TvLiveChannel,
    type TvLivePlaybackResult,
    type TvLiveSource,
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
 * `libs/tv/shell/feature` talks to (tv-mode plan, "Data adapters").
 * `initialize()` activates the FIRST playlist `PlaylistsService.
 * getAllPlaylists()` returns, matching the previous v1 behavior; `sources()`
 * lists every playlist and `selectPlaylist(id)` switches mid-session for the
 * source-switcher panel.
 */
@Injectable({ providedIn: 'root' })
export class TvLiveCatalogFacade {
    private readonly playlistsService = inject(PlaylistsService);
    private readonly xtreamAdapter = inject(XtreamTvSourceAdapter);
    private readonly stalkerAdapter = inject(StalkerTvSourceAdapter);
    private readonly m3uAdapter = inject(M3uTvSourceAdapter);

    private readonly activeAdapter = signal<TvLiveSourceAdapter | null>(null);
    private allPlaylists: readonly PlaylistMeta[] = [];

    readonly status = signal<TvLiveCatalogStatus>('loading');
    readonly playlistTitle = signal<string | null>(null);
    /** All playlists tv mode can switch to — feeds the source-switcher panel. */
    readonly sources = signal<readonly TvLiveSource[]>([]);
    readonly activePlaylistId = signal<string | null>(null);

    async initialize(): Promise<void> {
        this.status.set('loading');
        this.activeAdapter.set(null);
        this.playlistTitle.set(null);
        this.sources.set([]);
        this.activePlaylistId.set(null);

        let playlists: readonly PlaylistMeta[];
        try {
            playlists = await firstValueFrom(
                this.playlistsService.getAllPlaylists()
            );
        } catch {
            this.status.set('error');
            return;
        }

        this.allPlaylists = playlists;
        this.sources.set(
            playlists.map((playlist) => ({
                id: playlist._id,
                title: playlist.title,
                kind: resolveTvLiveSourceKind(playlist),
            }))
        );

        if (playlists.length === 0) {
            this.status.set('no-playlists');
            return;
        }

        await this.activatePlaylist(playlists[0]);
    }

    /**
     * Switches the active source mid-session — the source-switcher panel's
     * only entry point. No-ops for an unknown id (the panel only ever offers
     * ids from `sources()`, but a stale selection racing a playlist removal
     * shouldn't throw). Reuses the same activation tail `initialize()` runs
     * for the first playlist, so both paths stay in lockstep.
     */
    async selectPlaylist(id: string): Promise<void> {
        const playlist = this.allPlaylists.find((item) => item._id === id);
        if (!playlist) {
            return;
        }
        this.status.set('loading');
        await this.activatePlaylist(playlist);
    }

    private async activatePlaylist(playlist: PlaylistMeta): Promise<void> {
        const adapter = this.adapterFor(playlist);
        try {
            await adapter.initialize(playlist);
        } catch {
            this.activeAdapter.set(null);
            this.playlistTitle.set(null);
            this.activePlaylistId.set(null);
            this.status.set('error');
            return;
        }

        this.activeAdapter.set(adapter);
        this.playlistTitle.set(playlist.title);
        this.activePlaylistId.set(playlist._id);
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
