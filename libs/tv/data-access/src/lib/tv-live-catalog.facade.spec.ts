import { TestBed } from '@angular/core/testing';
import { PlaylistsService, SettingsStore } from '@iptvnator/services';
import type { PlaylistMeta } from '@iptvnator/shared/interfaces';
import { of, throwError } from 'rxjs';
import { TvLiveCatalogFacade } from './tv-live-catalog.facade';
import { M3uTvEpgGuideAdapter } from './epg-guide-adapters/m3u-tv-epg-guide-adapter.service';
import { StalkerTvEpgGuideAdapter } from './epg-guide-adapters/stalker-tv-epg-guide-adapter.service';
import { XtreamTvEpgGuideAdapter } from './epg-guide-adapters/xtream-tv-epg-guide-adapter.service';
import { M3uTvSourceAdapter } from './source-adapters/m3u-tv-source-adapter.service';
import { StalkerTvSourceAdapter } from './source-adapters/stalker-tv-source-adapter.service';
import { XtreamTvSourceAdapter } from './source-adapters/xtream-tv-source-adapter.service';

function fakeGuideAdapter() {
    return {
        channels: jest.fn().mockReturnValue([]),
        loadPrograms: jest.fn().mockResolvedValue(new Map()),
    };
}

function fakeAdapter() {
    return {
        initialize: jest.fn().mockResolvedValue(undefined),
        categories: jest.fn().mockReturnValue([{ id: 'all', name: 'All' }]),
        selectCategory: jest.fn(),
        channels: jest.fn().mockReturnValue([]),
        resolvePlayback: jest.fn().mockResolvedValue({ streamUrl: 'x' }),
        channelsAcrossCategories: undefined as jest.Mock | undefined,
        recordRecentlyViewed: undefined as jest.Mock | undefined,
        recentChannels: undefined as jest.Mock | undefined,
    };
}

describe('TvLiveCatalogFacade', () => {
    let getAllPlaylists: jest.Mock;
    let xtream: ReturnType<typeof fakeAdapter>;
    let stalker: ReturnType<typeof fakeAdapter>;
    let m3u: ReturnType<typeof fakeAdapter>;
    let xtreamGuide: ReturnType<typeof fakeGuideAdapter>;
    let stalkerGuide: ReturnType<typeof fakeGuideAdapter>;
    let m3uGuide: ReturnType<typeof fakeGuideAdapter>;
    let tvLastPlaylistId: string | undefined;
    let updateSettings: jest.Mock;
    let loadSettings: jest.Mock;

    beforeEach(() => {
        getAllPlaylists = jest.fn();
        xtream = fakeAdapter();
        stalker = fakeAdapter();
        m3u = fakeAdapter();
        xtreamGuide = fakeGuideAdapter();
        stalkerGuide = fakeGuideAdapter();
        m3uGuide = fakeGuideAdapter();
        tvLastPlaylistId = undefined;
        updateSettings = jest.fn().mockResolvedValue(undefined);
        loadSettings = jest.fn().mockResolvedValue(undefined);

        TestBed.configureTestingModule({
            providers: [
                {
                    provide: PlaylistsService,
                    useValue: { getAllPlaylists },
                },
                {
                    provide: SettingsStore,
                    useValue: {
                        getSettings: () => ({ tvLastPlaylistId }),
                        updateSettings,
                        loadSettings,
                    },
                },
                { provide: XtreamTvSourceAdapter, useValue: xtream },
                { provide: StalkerTvSourceAdapter, useValue: stalker },
                { provide: M3uTvSourceAdapter, useValue: m3u },
                { provide: XtreamTvEpgGuideAdapter, useValue: xtreamGuide },
                { provide: StalkerTvEpgGuideAdapter, useValue: stalkerGuide },
                { provide: M3uTvEpgGuideAdapter, useValue: m3uGuide },
            ],
        });
    });

    function createFacade(): TvLiveCatalogFacade {
        return TestBed.inject(TvLiveCatalogFacade);
    }

    it('reports no-playlists when none exist', async () => {
        getAllPlaylists.mockReturnValue(of([]));
        const facade = createFacade();

        await facade.initialize();

        expect(facade.status()).toBe('no-playlists');
        expect(facade.categories()).toEqual([]);
    });

    it('reports error when the playlist list fails to load', async () => {
        getAllPlaylists.mockReturnValue(throwError(() => new Error('boom')));
        const facade = createFacade();

        await facade.initialize();

        expect(facade.status()).toBe('error');
    });

    it('picks the Xtream adapter for a credentialed Xtream playlist', async () => {
        const playlist = {
            _id: 'p1',
            title: 'My Xtream',
            serverUrl: 'https://panel.test',
            username: 'u',
            password: 'p',
        } as PlaylistMeta;
        getAllPlaylists.mockReturnValue(of([playlist]));
        const facade = createFacade();

        await facade.initialize();

        expect(xtream.initialize).toHaveBeenCalledWith(playlist);
        expect(stalker.initialize).not.toHaveBeenCalled();
        expect(m3u.initialize).not.toHaveBeenCalled();
        expect(facade.status()).toBe('ready');
        expect(facade.playlistTitle()).toBe('My Xtream');
    });

    it('picks the Stalker adapter for a portal/MAC playlist', async () => {
        const playlist = {
            _id: 'p1',
            title: 'My Stalker',
            portalUrl: 'https://portal.test/c',
            macAddress: '00:1A:79:00:00:00',
        } as PlaylistMeta;
        getAllPlaylists.mockReturnValue(of([playlist]));
        const facade = createFacade();

        await facade.initialize();

        expect(stalker.initialize).toHaveBeenCalledWith(playlist);
        expect(xtream.initialize).not.toHaveBeenCalled();
    });

    it('falls back to the M3U adapter for anything else', async () => {
        const playlist = {
            _id: 'p1',
            title: 'My M3U',
            url: 'https://example.test/list.m3u',
        } as PlaylistMeta;
        getAllPlaylists.mockReturnValue(of([playlist]));
        const facade = createFacade();

        await facade.initialize();

        expect(m3u.initialize).toHaveBeenCalledWith(playlist);
    });

    it('always picks the first playlist when several exist', async () => {
        const first = { _id: 'p1', title: 'First' } as PlaylistMeta;
        const second = { _id: 'p2', title: 'Second' } as PlaylistMeta;
        getAllPlaylists.mockReturnValue(of([first, second]));
        const facade = createFacade();

        await facade.initialize();

        expect(m3u.initialize).toHaveBeenCalledWith(first);
        expect(facade.playlistTitle()).toBe('First');
    });

    it('reports error and clears the active adapter when adapter.initialize rejects', async () => {
        const playlist = { _id: 'p1', title: 'Broken' } as PlaylistMeta;
        getAllPlaylists.mockReturnValue(of([playlist]));
        m3u.initialize.mockRejectedValue(new Error('boom'));
        const facade = createFacade();

        await facade.initialize();

        expect(facade.status()).toBe('error');
        expect(facade.categories()).toEqual([]);
    });

    it('delegates selectCategory/channels/resolvePlayback to the active adapter', async () => {
        const playlist = { _id: 'p1', title: 'M3U' } as PlaylistMeta;
        getAllPlaylists.mockReturnValue(of([playlist]));
        const facade = createFacade();
        await facade.initialize();

        facade.selectCategory('sports');
        expect(m3u.selectCategory).toHaveBeenCalledWith('sports');

        expect(facade.categories()).toEqual([{ id: 'all', name: 'All' }]);

        const channel = { id: 'c1' } as never;
        const result = await facade.resolvePlayback(channel);
        expect(m3u.resolvePlayback).toHaveBeenCalledWith(channel);
        expect(result).toEqual({ streamUrl: 'x' });
    });

    describe('channelsAcrossCategories', () => {
        it('delegates to the active adapter when it implements the optional method', async () => {
            const playlist = { _id: 'p1', title: 'M3U' } as PlaylistMeta;
            getAllPlaylists.mockReturnValue(of([playlist]));
            const allChannels = [{ id: 'c1' }, { id: 'c2' }] as never;
            m3u.channelsAcrossCategories = jest.fn().mockReturnValue(allChannels);
            const facade = createFacade();
            await facade.initialize();

            expect(facade.channelsAcrossCategories()).toBe(allChannels);
        });

        it('falls back to the category-scoped channels() when the adapter has no full-list method', async () => {
            const playlist = { _id: 'p1', title: 'M3U' } as PlaylistMeta;
            getAllPlaylists.mockReturnValue(of([playlist]));
            const scoped = [{ id: 'c1' }] as never;
            m3u.channels.mockReturnValue(scoped);
            const facade = createFacade();
            await facade.initialize();

            expect(facade.channelsAcrossCategories()).toBe(scoped);
        });

        it('returns an empty list before any playlist has initialized', () => {
            const facade = createFacade();
            expect(facade.channelsAcrossCategories()).toEqual([]);
        });
    });

    describe('epgGuideAdapter', () => {
        it('picks the guide adapter matching the active source kind', async () => {
            const playlist = {
                _id: 'p1',
                title: 'My Xtream',
                serverUrl: 'https://panel.test',
                username: 'u',
                password: 'p',
            } as PlaylistMeta;
            getAllPlaylists.mockReturnValue(of([playlist]));
            const facade = createFacade();

            await facade.initialize();

            expect(facade.epgGuideAdapter()).toBe(xtreamGuide);
        });

        it('switches guide adapters when the active source switches', async () => {
            const xtreamPlaylist = {
                _id: 'p1',
                title: 'Xtream',
                serverUrl: 'https://panel.test',
                username: 'u',
                password: 'p',
            } as PlaylistMeta;
            const m3uPlaylist = { _id: 'p2', title: 'M3U' } as PlaylistMeta;
            getAllPlaylists.mockReturnValue(of([xtreamPlaylist, m3uPlaylist]));
            const facade = createFacade();
            await facade.initialize();
            expect(facade.epgGuideAdapter()).toBe(xtreamGuide);

            await facade.selectPlaylist('p2');

            expect(facade.epgGuideAdapter()).toBe(m3uGuide);
        });

        it('returns null before any playlist has initialized', () => {
            const facade = createFacade();
            expect(facade.epgGuideAdapter()).toBeNull();
        });

        it('returns null again when activation fails', async () => {
            const playlist = { _id: 'p1', title: 'M3U' } as PlaylistMeta;
            getAllPlaylists.mockReturnValue(of([playlist]));
            m3u.initialize.mockRejectedValue(new Error('boom'));
            const facade = createFacade();

            await facade.initialize();

            expect(facade.epgGuideAdapter()).toBeNull();
        });
    });

    describe('recordRecentlyViewed / recentChannels', () => {
        it('delegates recordRecentlyViewed to the active adapter when implemented', async () => {
            const playlist = { _id: 'p1', title: 'M3U' } as PlaylistMeta;
            getAllPlaylists.mockReturnValue(of([playlist]));
            m3u.recordRecentlyViewed = jest.fn();
            const facade = createFacade();
            await facade.initialize();
            const channel = { id: 'c1' } as never;

            facade.recordRecentlyViewed(channel);

            expect(m3u.recordRecentlyViewed).toHaveBeenCalledWith(channel);
        });

        it('recordRecentlyViewed is a no-op when the adapter has no implementation', async () => {
            const playlist = { _id: 'p1', title: 'M3U' } as PlaylistMeta;
            getAllPlaylists.mockReturnValue(of([playlist]));
            const facade = createFacade();
            await facade.initialize();

            expect(() =>
                facade.recordRecentlyViewed({ id: 'c1' } as never)
            ).not.toThrow();
        });

        it('recordRecentlyViewed is a no-op before any playlist has initialized', () => {
            const facade = createFacade();
            expect(() =>
                facade.recordRecentlyViewed({ id: 'c1' } as never)
            ).not.toThrow();
        });

        it('delegates recentChannels to the active adapter when implemented', async () => {
            const playlist = { _id: 'p1', title: 'M3U' } as PlaylistMeta;
            getAllPlaylists.mockReturnValue(of([playlist]));
            const recent = [{ id: 'c1' }] as never;
            m3u.recentChannels = jest.fn().mockReturnValue(recent);
            const facade = createFacade();
            await facade.initialize();

            expect(facade.recentChannels()).toBe(recent);
        });

        it('recentChannels returns an empty list when the adapter has no implementation', async () => {
            const playlist = { _id: 'p1', title: 'M3U' } as PlaylistMeta;
            getAllPlaylists.mockReturnValue(of([playlist]));
            const facade = createFacade();
            await facade.initialize();

            expect(facade.recentChannels()).toEqual([]);
        });
    });

    it('resolvePlayback rejects before any playlist has initialized', async () => {
        const facade = createFacade();
        await expect(
            facade.resolvePlayback({ id: 'c1' } as never)
        ).rejects.toThrow('No active tv-mode source');
    });

    it('lists every playlist as a source, kind-resolved, for the switcher panel', async () => {
        const first = {
            _id: 'p1',
            title: 'First',
            serverUrl: 'https://panel.test',
            username: 'u',
            password: 'p',
        } as PlaylistMeta;
        const second = { _id: 'p2', title: 'Second' } as PlaylistMeta;
        getAllPlaylists.mockReturnValue(of([first, second]));
        const facade = createFacade();

        await facade.initialize();

        expect(facade.sources()).toEqual([
            { id: 'p1', title: 'First', kind: 'xtream' },
            { id: 'p2', title: 'Second', kind: 'm3u' },
        ]);
        expect(facade.activePlaylistId()).toBe('p1');
    });

    it('selectPlaylist switches the active adapter and re-initializes it', async () => {
        const first = { _id: 'p1', title: 'First' } as PlaylistMeta;
        const second = {
            _id: 'p2',
            title: 'Second',
            portalUrl: 'https://portal.test/c',
            macAddress: '00:1A:79:00:00:00',
        } as PlaylistMeta;
        getAllPlaylists.mockReturnValue(of([first, second]));
        const facade = createFacade();
        await facade.initialize();
        m3u.initialize.mockClear();

        await facade.selectPlaylist('p2');

        expect(stalker.initialize).toHaveBeenCalledWith(second);
        expect(m3u.initialize).not.toHaveBeenCalled();
        expect(facade.status()).toBe('ready');
        expect(facade.playlistTitle()).toBe('Second');
        expect(facade.activePlaylistId()).toBe('p2');
    });

    it('selectPlaylist no-ops for an id not in the current source list', async () => {
        const first = { _id: 'p1', title: 'First' } as PlaylistMeta;
        getAllPlaylists.mockReturnValue(of([first]));
        const facade = createFacade();
        await facade.initialize();
        m3u.initialize.mockClear();

        await facade.selectPlaylist('missing');

        expect(m3u.initialize).not.toHaveBeenCalled();
        expect(stalker.initialize).not.toHaveBeenCalled();
        expect(xtream.initialize).not.toHaveBeenCalled();
        expect(facade.activePlaylistId()).toBe('p1');
        expect(facade.status()).toBe('ready');
    });

    it('selectPlaylist reports error and clears the active source when the adapter rejects', async () => {
        const first = { _id: 'p1', title: 'First' } as PlaylistMeta;
        const second = { _id: 'p2', title: 'Second' } as PlaylistMeta;
        getAllPlaylists.mockReturnValue(of([first, second]));
        const facade = createFacade();
        await facade.initialize();
        m3u.initialize.mockRejectedValueOnce(new Error('boom'));

        await facade.selectPlaylist('p2');

        expect(facade.status()).toBe('error');
        expect(facade.activePlaylistId()).toBeNull();
        expect(facade.categories()).toEqual([]);
    });

    it('prefers the persisted tvLastPlaylistId over the first playlist', async () => {
        const first = { _id: 'p1', title: 'First' } as PlaylistMeta;
        const second = { _id: 'p2', title: 'Second' } as PlaylistMeta;
        tvLastPlaylistId = 'p2';
        getAllPlaylists.mockReturnValue(of([first, second]));
        const facade = createFacade();

        await facade.initialize();

        expect(m3u.initialize).toHaveBeenCalledWith(second);
        expect(facade.activePlaylistId()).toBe('p2');
    });

    it('falls back to the first playlist when tvLastPlaylistId is stale', async () => {
        const first = { _id: 'p1', title: 'First' } as PlaylistMeta;
        tvLastPlaylistId = 'no-longer-exists';
        getAllPlaylists.mockReturnValue(of([first]));
        const facade = createFacade();

        await facade.initialize();

        expect(m3u.initialize).toHaveBeenCalledWith(first);
    });

    it('persists the active playlist id on every successful activation', async () => {
        const first = { _id: 'p1', title: 'First' } as PlaylistMeta;
        const second = { _id: 'p2', title: 'Second' } as PlaylistMeta;
        getAllPlaylists.mockReturnValue(of([first, second]));
        const facade = createFacade();

        await facade.initialize();
        expect(updateSettings).toHaveBeenCalledWith({ tvLastPlaylistId: 'p1' });

        await facade.selectPlaylist('p2');
        expect(updateSettings).toHaveBeenCalledWith({ tvLastPlaylistId: 'p2' });
    });

    it('waits for the initial settings hydration before reading or writing tvLastPlaylistId, so a slow first load cannot silently revert the write', async () => {
        // Real-browser bug: SettingsStore's onInit hook fires loadSettings()
        // fire-and-forget on first injection, and its eventual full-object
        // patchState() clobbers anything written before it resolves — this
        // reproduces that ordering with a controllable, still-pending
        // loadSettings() promise.
        let resolveLoad!: () => void;
        loadSettings.mockReturnValue(
            new Promise<void>((resolve) => {
                resolveLoad = resolve;
            })
        );
        const first = { _id: 'p1', title: 'First' } as PlaylistMeta;
        getAllPlaylists.mockReturnValue(of([first]));
        const facade = createFacade();

        const initializePromise = facade.initialize();
        // Give initialize()'s playlist fetch a turn to resolve — it must
        // still be blocked on the pending loadSettings() rather than having
        // already read/written tvLastPlaylistId.
        await Promise.resolve();
        await Promise.resolve();
        expect(updateSettings).not.toHaveBeenCalled();

        resolveLoad();
        await initializePromise;

        expect(updateSettings).toHaveBeenCalledWith({ tvLastPlaylistId: 'p1' });
    });

    it('does not persist a last-playlist id when activation fails', async () => {
        const playlist = { _id: 'p1', title: 'Broken' } as PlaylistMeta;
        getAllPlaylists.mockReturnValue(of([playlist]));
        m3u.initialize.mockRejectedValue(new Error('boom'));
        const facade = createFacade();

        await facade.initialize();

        expect(updateSettings).not.toHaveBeenCalled();
    });

    describe('addedNewSource', () => {
        it('refetches the playlist list and activates the new source by id', async () => {
            const first = { _id: 'p1', title: 'First' } as PlaylistMeta;
            const added = {
                _id: 'p2',
                title: 'Just added',
                portalUrl: 'https://portal.test/c',
                macAddress: '00:1A:79:00:00:00',
            } as PlaylistMeta;
            getAllPlaylists.mockReturnValueOnce(of([first]));
            const facade = createFacade();
            await facade.initialize();

            getAllPlaylists.mockReturnValueOnce(of([first, added]));
            await facade.addedNewSource('p2');

            expect(stalker.initialize).toHaveBeenCalledWith(added);
            expect(facade.status()).toBe('ready');
            expect(facade.activePlaylistId()).toBe('p2');
            expect(facade.sources()).toEqual([
                { id: 'p1', title: 'First', kind: 'm3u' },
                { id: 'p2', title: 'Just added', kind: 'stalker' },
            ]);
        });

        it('reports error when the new id is not found after refetching', async () => {
            const first = { _id: 'p1', title: 'First' } as PlaylistMeta;
            getAllPlaylists.mockReturnValueOnce(of([first]));
            const facade = createFacade();
            await facade.initialize();

            getAllPlaylists.mockReturnValueOnce(of([first]));
            await facade.addedNewSource('missing');

            expect(facade.status()).toBe('error');
        });

        it('reports error when the refetch itself fails', async () => {
            const first = { _id: 'p1', title: 'First' } as PlaylistMeta;
            getAllPlaylists.mockReturnValueOnce(of([first]));
            const facade = createFacade();
            await facade.initialize();

            getAllPlaylists.mockReturnValueOnce(throwError(() => new Error('boom')));
            await facade.addedNewSource('p2');

            expect(facade.status()).toBe('error');
        });
    });
});
