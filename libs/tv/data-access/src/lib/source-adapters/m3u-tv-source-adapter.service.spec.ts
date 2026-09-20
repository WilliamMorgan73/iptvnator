import { TestBed } from '@angular/core/testing';
import { playlistReducer } from '@iptvnator/m3u-state';
import { PlaylistsService } from '@iptvnator/services';
import type { Channel, Playlist, PlaylistMeta } from '@iptvnator/shared/interfaces';
import { provideStore } from '@ngrx/store';
import { of } from 'rxjs';
import { M3uTvSourceAdapter } from './m3u-tv-source-adapter.service';

function channel(overrides: Partial<Channel>): Channel {
    return {
        id: overrides.id ?? 'id',
        url: overrides.url ?? 'https://example.test/stream',
        name: overrides.name ?? 'Channel',
        group: overrides.group ?? { title: '' },
        tvg: { id: '', name: '', url: '', logo: '', rec: '' },
        http: { referrer: '', 'user-agent': '', origin: '' },
        radio: 'false',
        ...overrides,
    } as Channel;
}

describe('M3uTvSourceAdapter', () => {
    let getPlaylist: jest.Mock;

    beforeEach(() => {
        getPlaylist = jest.fn();
        TestBed.configureTestingModule({
            providers: [
                provideStore({ playlistState: playlistReducer }),
                { provide: PlaylistsService, useValue: { getPlaylist } },
            ],
        });
    });

    function createAdapter(): M3uTvSourceAdapter {
        return TestBed.inject(M3uTvSourceAdapter);
    }

    it('loads the playlist channels via PlaylistsService.getPlaylist', async () => {
        const channels = [
            channel({ id: 'ch1', name: 'Nova Sports 1', group: { title: 'Sports' } }),
        ];
        getPlaylist.mockReturnValue(
            of({ playlist: { items: channels } } as Partial<Playlist>)
        );

        const adapter = createAdapter();
        await adapter.initialize({ _id: 'p1' } as PlaylistMeta);

        expect(getPlaylist).toHaveBeenCalledWith('p1');
        expect(adapter.channels().map((c) => c.name)).toEqual([
            'Nova Sports 1',
        ]);
    });

    it('groups categories from channel.group.title, All first', async () => {
        const channels = [
            channel({ id: 'ch1', name: 'A', group: { title: 'Sports' } }),
            channel({ id: 'ch2', name: 'B', group: { title: 'News' } }),
            channel({ id: 'ch3', name: 'C', group: { title: 'Sports' } }),
        ];
        getPlaylist.mockReturnValue(
            of({ playlist: { items: channels } } as Partial<Playlist>)
        );

        const adapter = createAdapter();
        await adapter.initialize({ _id: 'p1' } as PlaylistMeta);

        expect(adapter.categories()).toEqual([
            { id: 'all', name: 'All' },
            { id: 'News', name: 'News' },
            { id: 'Sports', name: 'Sports' },
        ]);
    });

    it('adds an Ungrouped category only when some channel has no group title', async () => {
        const channels = [
            channel({ id: 'ch1', name: 'A', group: { title: 'Sports' } }),
            channel({ id: 'ch2', name: 'B', group: { title: '' } }),
        ];
        getPlaylist.mockReturnValue(
            of({ playlist: { items: channels } } as Partial<Playlist>)
        );

        const adapter = createAdapter();
        await adapter.initialize({ _id: 'p1' } as PlaylistMeta);

        expect(adapter.categories()).toEqual([
            { id: 'all', name: 'All' },
            { id: 'Sports', name: 'Sports' },
            { id: 'ungrouped', name: 'Ungrouped' },
        ]);
    });

    it('selectCategory filters channels() by group title', async () => {
        const channels = [
            channel({ id: 'ch1', name: 'A', group: { title: 'Sports' } }),
            channel({ id: 'ch2', name: 'B', group: { title: 'News' } }),
        ];
        getPlaylist.mockReturnValue(
            of({ playlist: { items: channels } } as Partial<Playlist>)
        );

        const adapter = createAdapter();
        await adapter.initialize({ _id: 'p1' } as PlaylistMeta);

        adapter.selectCategory('News');
        expect(adapter.channels().map((c) => c.name)).toEqual(['B']);

        adapter.selectCategory('all');
        expect(adapter.channels().map((c) => c.name)).toEqual(['A', 'B']);
    });

    it('resolves playback from channel.url and channel.http', async () => {
        const channels = [
            channel({
                id: 'ch1',
                name: 'A',
                url: 'https://stream.test/a.m3u8',
                http: {
                    referrer: 'https://ref.test',
                    'user-agent': 'IPTVnator',
                    origin: 'https://ref.test',
                },
            }),
        ];
        getPlaylist.mockReturnValue(
            of({ playlist: { items: channels } } as Partial<Playlist>)
        );

        const adapter = createAdapter();
        await adapter.initialize({ _id: 'p1' } as PlaylistMeta);
        const [tvChannel] = adapter.channels();

        const playback = await adapter.resolvePlayback(tvChannel);

        expect(playback).toEqual({
            streamUrl: 'https://stream.test/a.m3u8',
            userAgent: 'IPTVnator',
            referer: 'https://ref.test',
            origin: 'https://ref.test',
        });
    });
});
