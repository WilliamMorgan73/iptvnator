import { Injectable, inject, signal } from '@angular/core';
import { PlaylistsService, SettingsStore } from '@iptvnator/services';
import type { PlaylistMeta } from '@iptvnator/shared/interfaces';
import {
    resolveTvLiveSourceKind,
    type TvEpgGuideAdapter,
    type TvLiveCategory,
    type TvLiveChannel,
    type TvLivePlaybackResult,
    type TvLiveSource,
    type TvLiveSourceAdapter,
} from '@iptvnator/tv/util';
import { firstValueFrom } from 'rxjs';
import { M3uTvEpgGuideAdapter } from './epg-guide-adapters/m3u-tv-epg-guide-adapter.service';
import { StalkerTvEpgGuideAdapter } from './epg-guide-adapters/stalker-tv-epg-guide-adapter.service';
import { XtreamTvEpgGuideAdapter } from './epg-guide-adapters/xtream-tv-epg-guide-adapter.service';
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
    private readonly settingsStore = inject(SettingsStore);
    private readonly xtreamAdapter = inject(XtreamTvSourceAdapter);
    private readonly stalkerAdapter = inject(StalkerTvSourceAdapter);
    private readonly m3uAdapter = inject(M3uTvSourceAdapter);
    private readonly xtreamGuideAdapter = inject(XtreamTvEpgGuideAdapter);
    private readonly stalkerGuideAdapter = inject(StalkerTvEpgGuideAdapter);
    private readonly m3uGuideAdapter = inject(M3uTvEpgGuideAdapter);

    private readonly activeAdapter = signal<TvLiveSourceAdapter | null>(null);
    private readonly activeGuideAdapter = signal<TvEpgGuideAdapter | null>(
        null
    );
    private allPlaylists: readonly PlaylistMeta[] = [];

    readonly status = signal<TvLiveCatalogStatus>('loading');
    readonly playlistTitle = signal<string | null>(null);
    /** All playlists tv mode can switch to — feeds the source-switcher panel. */
    readonly sources = signal<readonly TvLiveSource[]>([]);
    readonly activePlaylistId = signal<string | null>(null);

    async initialize(): Promise<void> {
        this.status.set('loading');
        this.activeAdapter.set(null);
        this.activeGuideAdapter.set(null);
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

        // SettingsStore's own onInit hook kicks off loadSettings()
        // fire-and-forget on first injection — this facade is commonly that
        // first injection (e.g. landing straight on /add-source), so without
        // this await tvLastPlaylistId reads as the pre-hydration default.
        // loadSettings() is memoized, so this is a no-op once it has already
        // resolved.
        await this.settingsStore.loadSettings();
        const lastId = this.settingsStore.getSettings().tvLastPlaylistId;
        const preferred = lastId
            ? playlists.find((item) => item._id === lastId)
            : undefined;
        await this.activatePlaylist(preferred ?? playlists[0]);
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

    /**
     * Called after Add Source succeeds — the new playlist isn't in
     * `allPlaylists` yet (it was created after `initialize()` last read the
     * list), so this re-fetches before activating it by id.
     */
    async addedNewSource(playlistId: string): Promise<void> {
        this.status.set('loading');
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

        const playlist = playlists.find((item) => item._id === playlistId);
        if (!playlist) {
            this.status.set('error');
            return;
        }
        await this.activatePlaylist(playlist);
    }

    private async activatePlaylist(playlist: PlaylistMeta): Promise<void> {
        const adapter = this.adapterFor(playlist);
        try {
            await adapter.initialize(playlist);
        } catch {
            this.activeAdapter.set(null);
            this.activeGuideAdapter.set(null);
            this.playlistTitle.set(null);
            this.activePlaylistId.set(null);
            this.status.set('error');
            return;
        }

        this.activeAdapter.set(adapter);
        this.activeGuideAdapter.set(this.guideAdapterFor(playlist));
        this.playlistTitle.set(playlist.title);
        this.activePlaylistId.set(playlist._id);
        this.status.set('ready');
        // Same hydration-race guard as initialize()'s read: writing before
        // the initial load lands would have this update silently reverted
        // when that load's full-object patch resolves afterward — a real
        // failure caught by driving this through a real browser, not just
        // the unit tests' pre-seeded store.
        await this.settingsStore.loadSettings();
        void this.settingsStore.updateSettings({
            tvLastPlaylistId: playlist._id,
        });
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

    /** The whole active source's channels, across every category — feeds
     * numeric channel entry (`TvDigitEntryController`). Falls back to the
     * category-scoped `channels()` when the adapter has no cheaper way to
     * get a full list (see `TvLiveSourceAdapter.channelsAcrossCategories`). */
    channelsAcrossCategories(): readonly TvLiveChannel[] {
        const adapter = this.activeAdapter();
        return adapter?.channelsAcrossCategories?.() ?? this.channels();
    }

    /** Records a confirmed activation — the shell's single correct call site
     * (`playChannel()`/`jumpToChannelByNumber()`), never a preview. No-ops
     * when the active adapter doesn't implement it. */
    recordRecentlyViewed(channel: TvLiveChannel): void {
        this.activeAdapter()?.recordRecentlyViewed?.(channel);
    }

    /** Recently (confirmed-)played channels for the active source, feeding
     * the Recently Viewed pane. Empty when the adapter doesn't implement it. */
    recentChannels(): readonly TvLiveChannel[] {
        return this.activeAdapter()?.recentChannels?.() ?? [];
    }

    /** The active source's programme-guide adapter, or `null` before any
     * source has activated. */
    epgGuideAdapter(): TvEpgGuideAdapter | null {
        return this.activeGuideAdapter();
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

    private guideAdapterFor(playlist: PlaylistMeta): TvEpgGuideAdapter {
        switch (resolveTvLiveSourceKind(playlist)) {
            case 'xtream':
                return this.xtreamGuideAdapter;
            case 'stalker':
                return this.stalkerGuideAdapter;
            case 'm3u':
                return this.m3uGuideAdapter;
        }
    }
}
