import { TestBed } from '@angular/core/testing';
import { EpgRuntimeBridgeService } from '@iptvnator/epg/data-access';
import { playlistReducer } from '@iptvnator/m3u-state';
import { PlaylistsService, SettingsStore } from '@iptvnator/services';
import type {
    Channel,
    EpgProgram,
    Playlist,
    PlaylistMeta,
} from '@iptvnator/shared/interfaces';
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

function epgProgram(overrides: Partial<EpgProgram> = {}): EpgProgram {
    return {
        start: new Date(Date.now() - 60_000).toISOString(),
        stop: new Date(Date.now() + 60_000).toISOString(),
        channel: 'ch1',
        title: 'Now Playing',
        desc: 'A description.',
        category: null,
        startTimestamp: Math.floor((Date.now() - 60_000) / 1000),
        stopTimestamp: Math.floor((Date.now() + 60_000) / 1000),
        ...overrides,
    };
}

describe('M3uTvSourceAdapter', () => {
    let getPlaylist: jest.Mock;
    let getCurrentProgramsBatch: jest.Mock;
    let getPlaylistRecentlyViewed: jest.Mock;
    let addM3uRecentlyViewed: jest.Mock;

    beforeEach(() => {
        getPlaylist = jest.fn();
        getCurrentProgramsBatch = jest.fn().mockResolvedValue(null);
        getPlaylistRecentlyViewed = jest.fn().mockReturnValue(of([]));
        addM3uRecentlyViewed = jest.fn().mockReturnValue(of(undefined));
        TestBed.configureTestingModule({
            providers: [
                provideStore({ playlistState: playlistReducer }),
                {
                    provide: PlaylistsService,
                    useValue: {
                        getPlaylist,
                        getPlaylistRecentlyViewed,
                        addM3uRecentlyViewed,
                    },
                },
                {
                    provide: EpgRuntimeBridgeService,
                    useValue: { getCurrentProgramsBatch },
                },
                {
                    provide: SettingsStore,
                    useValue: { resolvedEpgOffsetMinutes: () => 0 },
                },
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

    it('channelsAcrossCategories() ignores the selected category', async () => {
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

        expect(
            adapter.channelsAcrossCategories().map((c) => c.name)
        ).toEqual(['A', 'B']);
    });

    describe('recently viewed', () => {
        it('persists a confirmed activation with the same fields desktop uses', async () => {
            const channels = [
                channel({
                    id: 'ch1',
                    name: 'A',
                    url: 'https://stream.test/a.m3u8',
                    group: { title: 'Sports' },
                    tvg: { id: 'tvg-a', name: 'A tvg', url: '', logo: 'https://example.test/a.png', rec: '' },
                }),
            ];
            getPlaylist.mockReturnValue(
                of({ playlist: { items: channels } } as Partial<Playlist>)
            );
            const adapter = createAdapter();
            await adapter.initialize({ _id: 'p1' } as PlaylistMeta);
            const [tvChannel] = adapter.channels();

            adapter.recordRecentlyViewed?.(tvChannel);

            expect(addM3uRecentlyViewed).toHaveBeenCalledWith(
                'p1',
                expect.objectContaining({
                    source: 'm3u',
                    id: 'https://stream.test/a.m3u8',
                    url: 'https://stream.test/a.m3u8',
                    title: 'A',
                    channel_id: 'ch1',
                    poster_url: 'https://example.test/a.png',
                    tvg_id: 'tvg-a',
                    group_title: 'Sports',
                    category_id: 'live',
                })
            );
        });

        it('matches recent rows back to channels by URL, most-recent-first', async () => {
            const channels = [
                channel({ id: 'ch1', name: 'A', url: 'https://stream.test/a.m3u8' }),
                channel({ id: 'ch2', name: 'B', url: 'https://stream.test/b.m3u8' }),
            ];
            getPlaylist.mockReturnValue(
                of({ playlist: { items: channels } } as Partial<Playlist>)
            );
            getPlaylistRecentlyViewed.mockReturnValue(
                of([
                    { source: 'm3u', url: 'https://stream.test/b.m3u8' },
                    { source: 'm3u', url: 'https://stream.test/a.m3u8' },
                ])
            );
            const adapter = createAdapter();
            await adapter.initialize({ _id: 'p1' } as PlaylistMeta);
            await Promise.resolve();
            await Promise.resolve();

            expect(adapter.recentChannels?.().map((c) => c.name)).toEqual([
                'B',
                'A',
            ]);
        });

        it('falls back to channel_id when the URL no longer matches', async () => {
            const channels = [
                channel({ id: 'ch1', name: 'A', url: 'https://stream.test/new-url.m3u8' }),
            ];
            getPlaylist.mockReturnValue(
                of({ playlist: { items: channels } } as Partial<Playlist>)
            );
            getPlaylistRecentlyViewed.mockReturnValue(
                of([
                    {
                        source: 'm3u',
                        url: 'https://stream.test/old-url.m3u8',
                        channel_id: 'ch1',
                    },
                ])
            );
            const adapter = createAdapter();
            await adapter.initialize({ _id: 'p1' } as PlaylistMeta);
            await Promise.resolve();
            await Promise.resolve();

            expect(adapter.recentChannels?.().map((c) => c.name)).toEqual([
                'A',
            ]);
        });

        it('omits a recent channel no longer present in the playlist', async () => {
            getPlaylist.mockReturnValue(
                of({ playlist: { items: [] } } as Partial<Playlist>)
            );
            getPlaylistRecentlyViewed.mockReturnValue(
                of([{ source: 'm3u', url: 'https://stream.test/gone.m3u8' }])
            );
            const adapter = createAdapter();
            await adapter.initialize({ _id: 'p1' } as PlaylistMeta);
            await Promise.resolve();
            await Promise.resolve();

            expect(adapter.recentChannels?.()).toEqual([]);
        });

        it('excludes a non-M3U entry from the shared recently_viewed column', async () => {
            const channels = [
                channel({ id: 'ch1', name: 'A', url: 'https://stream.test/a.m3u8' }),
            ];
            getPlaylist.mockReturnValue(
                of({ playlist: { items: channels } } as Partial<Playlist>)
            );
            getPlaylistRecentlyViewed.mockReturnValue(
                of([{ source: 'stalker', id: 'x', title: 'Not M3U' }])
            );
            const adapter = createAdapter();
            await adapter.initialize({ _id: 'p1' } as PlaylistMeta);
            await Promise.resolve();
            await Promise.resolve();

            expect(adapter.recentChannels?.()).toEqual([]);
        });
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

    describe('EPG population', () => {
        it('fetches the current-programs batch for the visible channels on initialize', async () => {
            const channels = [
                channel({ id: 'ch1', name: 'A', group: { title: 'Sports' } }),
                channel({ id: 'ch2', name: 'B', group: { title: 'Sports' } }),
            ];
            getPlaylist.mockReturnValue(
                of({ playlist: { items: channels } } as Partial<Playlist>)
            );

            const adapter = createAdapter();
            await adapter.initialize({ _id: 'p1' } as PlaylistMeta);
            await Promise.resolve();
            await Promise.resolve();

            expect(getCurrentProgramsBatch).toHaveBeenCalledWith(
                ['A', 'B'],
                { nowMs: expect.any(Number) }
            );
        });

        it('leaves the current-programme fields unset before the batch resolves', async () => {
            const channels = [channel({ id: 'ch1', name: 'A' })];
            getPlaylist.mockReturnValue(
                of({ playlist: { items: channels } } as Partial<Playlist>)
            );

            const adapter = createAdapter();
            await adapter.initialize({ _id: 'p1' } as PlaylistMeta);
            const [tvChannel] = adapter.channels();

            expect(tvChannel.currentProgramTitle).toBeUndefined();
        });

        it('populates current-programme fields once the batch resolves', async () => {
            const channels = [channel({ id: 'ch1', name: 'A' })];
            getPlaylist.mockReturnValue(
                of({ playlist: { items: channels } } as Partial<Playlist>)
            );
            getCurrentProgramsBatch.mockResolvedValue({
                A: epgProgram(),
            });

            const adapter = createAdapter();
            await adapter.initialize({ _id: 'p1' } as PlaylistMeta);
            await Promise.resolve();
            await Promise.resolve();

            const [tvChannel] = adapter.channels();
            expect(tvChannel.currentProgramTitle).toBe('Now Playing');
            expect(tvChannel.currentProgramDescription).toBe(
                'A description.'
            );
            expect(tvChannel.currentProgramProgress).toBeGreaterThan(0);
            expect(tvChannel.currentProgramProgress).toBeLessThan(1);
        });

        it('re-fetches with the new category set when selectCategory changes it', async () => {
            const channels = [
                channel({ id: 'ch1', name: 'A', group: { title: 'Sports' } }),
                channel({ id: 'ch2', name: 'B', group: { title: 'News' } }),
            ];
            getPlaylist.mockReturnValue(
                of({ playlist: { items: channels } } as Partial<Playlist>)
            );

            const adapter = createAdapter();
            await adapter.initialize({ _id: 'p1' } as PlaylistMeta);
            await Promise.resolve();
            await Promise.resolve();
            getCurrentProgramsBatch.mockClear();

            adapter.selectCategory('News');
            await Promise.resolve();
            await Promise.resolve();

            expect(getCurrentProgramsBatch).toHaveBeenCalledWith(['B'], {
                nowMs: expect.any(Number),
            });
        });
    });
});
