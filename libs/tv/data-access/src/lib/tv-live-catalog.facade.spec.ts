import { TestBed } from '@angular/core/testing';
import { PlaylistsService } from '@iptvnator/services';
import type { PlaylistMeta } from '@iptvnator/shared/interfaces';
import { of, throwError } from 'rxjs';
import { TvLiveCatalogFacade } from './tv-live-catalog.facade';
import { M3uTvSourceAdapter } from './source-adapters/m3u-tv-source-adapter.service';
import { StalkerTvSourceAdapter } from './source-adapters/stalker-tv-source-adapter.service';
import { XtreamTvSourceAdapter } from './source-adapters/xtream-tv-source-adapter.service';

function fakeAdapter() {
    return {
        initialize: jest.fn().mockResolvedValue(undefined),
        categories: jest.fn().mockReturnValue([{ id: 'all', name: 'All' }]),
        selectCategory: jest.fn(),
        channels: jest.fn().mockReturnValue([]),
        resolvePlayback: jest.fn().mockResolvedValue({ streamUrl: 'x' }),
    };
}

describe('TvLiveCatalogFacade', () => {
    let getAllPlaylists: jest.Mock;
    let xtream: ReturnType<typeof fakeAdapter>;
    let stalker: ReturnType<typeof fakeAdapter>;
    let m3u: ReturnType<typeof fakeAdapter>;

    beforeEach(() => {
        getAllPlaylists = jest.fn();
        xtream = fakeAdapter();
        stalker = fakeAdapter();
        m3u = fakeAdapter();

        TestBed.configureTestingModule({
            providers: [
                {
                    provide: PlaylistsService,
                    useValue: { getAllPlaylists },
                },
                { provide: XtreamTvSourceAdapter, useValue: xtream },
                { provide: StalkerTvSourceAdapter, useValue: stalker },
                { provide: M3uTvSourceAdapter, useValue: m3u },
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
});
