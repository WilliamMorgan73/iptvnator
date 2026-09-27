import { TestBed } from '@angular/core/testing';
import {
    EpgQueueService,
    XtreamStore,
} from '@iptvnator/portal/xtream/data-access';
import { SettingsStore } from '@iptvnator/services';
import type { EpgItem, PlaylistMeta } from '@iptvnator/shared/interfaces';
import { Subject } from 'rxjs';
import { XtreamTvSourceAdapter } from './xtream-tv-source-adapter.service';

function epgItem(overrides: Partial<EpgItem> = {}): EpgItem {
    return {
        id: '1',
        epg_id: '1',
        title: 'Now Playing',
        lang: 'en',
        start: new Date(Date.now() - 60_000).toISOString(),
        end: new Date(Date.now() + 60_000).toISOString(),
        stop: new Date(Date.now() + 60_000).toISOString(),
        description: 'A description.',
        channel_id: '101',
        start_timestamp: String(Math.floor((Date.now() - 60_000) / 1000)),
        stop_timestamp: String(Math.floor((Date.now() + 60_000) / 1000)),
        ...overrides,
    };
}

describe('XtreamTvSourceAdapter', () => {
    let fakeStore: {
        setPlaylistId: jest.Mock;
        initialize: jest.Mock;
        setSelectedContentType: jest.Mock;
        setSelectedCategory: jest.Mock;
        liveCategories: jest.Mock;
        selectItemsFromSelectedCategory: jest.Mock;
        liveStreams: jest.Mock;
        constructStreamUrl: jest.Mock;
        currentPlaylist: jest.Mock;
        loadRecentItems: jest.Mock;
        addRecentItem: jest.Mock;
        recentItems: jest.Mock;
    };
    let fakeEpgQueue: {
        epgResult$: Subject<{ streamId: number; items: EpgItem[] }>;
        enqueue: jest.Mock;
        getCached: jest.Mock;
    };

    beforeEach(() => {
        fakeStore = {
            setPlaylistId: jest.fn(),
            initialize: jest.fn().mockResolvedValue(undefined),
            setSelectedContentType: jest.fn(),
            setSelectedCategory: jest.fn(),
            liveCategories: jest.fn().mockReturnValue([
                { category_id: '1', category_name: 'Sports' },
                { category_id: '2', category_name: 'News' },
            ]),
            selectItemsFromSelectedCategory: jest.fn().mockReturnValue([
                {
                    xtream_id: 101,
                    name: 'Nova Sports 1',
                    category_id: '1',
                    num: 101,
                    stream_icon: 'https://example.test/logo.png',
                    epg_channel_id: 'nova.sports.1',
                },
            ]),
            liveStreams: jest.fn().mockReturnValue([
                {
                    xtream_id: 101,
                    name: 'Nova Sports 1',
                    category_id: '1',
                    num: 101,
                    stream_icon: 'https://example.test/logo.png',
                    epg_channel_id: 'nova.sports.1',
                },
                {
                    xtream_id: 202,
                    name: 'CNN News',
                    category_id: '2',
                    num: 202,
                },
            ]),
            constructStreamUrl: jest.fn().mockReturnValue('https://stream.test/101'),
            currentPlaylist: jest.fn().mockReturnValue({
                id: 'p1',
                userAgent: 'IPTVnator',
                referrer: 'https://panel.test',
                origin: 'https://panel.test',
                serverUrl: 'https://panel.test',
                username: 'user',
                password: 'pass',
            }),
            loadRecentItems: jest.fn(),
            addRecentItem: jest.fn(),
            recentItems: jest.fn().mockReturnValue([]),
        };
        fakeEpgQueue = {
            epgResult$: new Subject(),
            enqueue: jest.fn().mockResolvedValue(undefined),
            getCached: jest.fn().mockReturnValue(null),
        };

        TestBed.configureTestingModule({
            providers: [
                { provide: XtreamStore, useValue: fakeStore },
                { provide: EpgQueueService, useValue: fakeEpgQueue },
                {
                    provide: SettingsStore,
                    useValue: { resolvedEpgOffsetMinutes: () => 0 },
                },
            ],
        });
    });

    function createAdapter(): XtreamTvSourceAdapter {
        return TestBed.inject(XtreamTvSourceAdapter);
    }

    it('initializes the store with the given playlist and switches to live', async () => {
        const adapter = createAdapter();
        const playlist = { _id: 'p1' } as PlaylistMeta;

        await adapter.initialize(playlist);

        expect(fakeStore.setPlaylistId).toHaveBeenCalledWith('p1');
        expect(fakeStore.initialize).toHaveBeenCalledTimes(1);
        expect(fakeStore.setSelectedContentType).toHaveBeenCalledWith('live');
        expect(fakeStore.loadRecentItems).toHaveBeenCalledWith({ id: 'p1' });
    });

    it('prepends a synthetic All category to the store categories', () => {
        const adapter = createAdapter();
        expect(adapter.categories()).toEqual([
            { id: 'all', name: 'All' },
            { id: '1', name: 'Sports' },
            { id: '2', name: 'News' },
        ]);
    });

    it('selecting All clears the store category filter', () => {
        const adapter = createAdapter();
        adapter.selectCategory('all');
        expect(fakeStore.setSelectedCategory).toHaveBeenCalledWith(null);
    });

    it('selecting a real category passes its numeric id', () => {
        const adapter = createAdapter();
        adapter.selectCategory('2');
        expect(fakeStore.setSelectedCategory).toHaveBeenCalledWith(2);
    });

    it('maps store items into TvLiveChannel', () => {
        const adapter = createAdapter();
        expect(adapter.channels()).toEqual([
            {
                id: '101',
                name: 'Nova Sports 1',
                categoryId: '1',
                sourceKind: 'xtream',
                logoUrl: 'https://example.test/logo.png',
                channelNumber: 101,
                playRef: {
                    xtream_id: 101,
                    name: 'Nova Sports 1',
                    category_id: '1',
                    num: 101,
                    stream_icon: 'https://example.test/logo.png',
                    epg_channel_id: 'nova.sports.1',
                },
            },
        ]);
    });

    describe('channelsAcrossCategories', () => {
        it('reads the whole playlist, not just the selected category', () => {
            const adapter = createAdapter();

            const channels = adapter.channelsAcrossCategories?.();

            expect(channels?.map((channel) => channel.id)).toEqual([
                '101',
                '202',
            ]);
            expect(fakeStore.liveStreams).toHaveBeenCalled();
        });

        it('filters out entries missing a numeric xtream_id or a name', () => {
            fakeStore.liveStreams.mockReturnValue([
                { xtream_id: 101, name: 'Nova Sports 1' },
                { name: 'No id' },
                { xtream_id: 303 },
            ]);
            const adapter = createAdapter();

            expect(
                adapter.channelsAcrossCategories?.().map((channel) => channel.id)
            ).toEqual(['101']);
        });
    });

    describe('recently viewed', () => {
        it('records a confirmed activation as the first-ever live recent item', () => {
            const adapter = createAdapter();
            const [channel] = adapter.channels();

            adapter.recordRecentlyViewed?.(channel);

            expect(fakeStore.addRecentItem).toHaveBeenCalledWith({
                xtreamId: 101,
                contentType: 'live',
                playlist: fakeStore.currentPlaylist,
                backdropUrl: 'https://example.test/logo.png',
            });
        });

        it('maps recent rows back to full TvLiveChannel objects from the catalog', () => {
            fakeStore.recentItems.mockReturnValue([
                { type: 'live', xtream_id: 202 },
                { type: 'movie', xtream_id: 101 }, // wrong type, excluded
            ]);
            const adapter = createAdapter();

            expect(adapter.recentChannels?.().map((c) => c.id)).toEqual([
                '202',
            ]);
        });

        it('omits a recent channel no longer present in the catalog', () => {
            fakeStore.recentItems.mockReturnValue([
                { type: 'live', xtream_id: 999 },
            ]);
            const adapter = createAdapter();

            expect(adapter.recentChannels?.()).toEqual([]);
        });
    });

    describe('EPG population', () => {
        it('enqueues the visible category streams when a category is selected', () => {
            const adapter = createAdapter();

            adapter.selectCategory('1');

            expect(fakeEpgQueue.enqueue).toHaveBeenCalledWith(
                [
                    {
                        streamId: 101,
                        epgChannelId: 'nova.sports.1',
                        playlistId: 'p1',
                    },
                ],
                new Set([101]),
                {
                    serverUrl: 'https://panel.test',
                    username: 'user',
                    password: 'pass',
                    serverTimezone: undefined,
                }
            );
        });

        it('leaves the current-programme fields unset before any EPG result arrives', () => {
            const adapter = createAdapter();
            const [channel] = adapter.channels();

            expect(channel.currentProgramTitle).toBeUndefined();
            expect(channel.currentProgramProgress).toBeUndefined();
        });

        it('populates current-programme fields once an EPG result arrives on epgResult$', () => {
            const adapter = createAdapter();
            const program = epgItem();

            fakeEpgQueue.epgResult$.next({ streamId: 101, items: [program] });
            const [channel] = adapter.channels();

            expect(channel.currentProgramTitle).toBe('Now Playing');
            expect(channel.currentProgramDescription).toBe('A description.');
            expect(channel.currentProgramProgress).toBeGreaterThan(0);
            expect(channel.currentProgramProgress).toBeLessThan(1);
        });

        it('falls back to the queue cache when no live result has arrived yet', () => {
            fakeEpgQueue.getCached.mockReturnValue([epgItem()]);
            const adapter = createAdapter();

            const [channel] = adapter.channels();

            expect(channel.currentProgramTitle).toBe('Now Playing');
        });
    });

    it('resolves playback URL and headers from the store', async () => {
        const adapter = createAdapter();
        const [channel] = adapter.channels();

        const playback = await adapter.resolvePlayback(channel);

        expect(fakeStore.constructStreamUrl).toHaveBeenCalledWith(
            channel.playRef
        );
        expect(playback).toEqual({
            streamUrl: 'https://stream.test/101',
            userAgent: 'IPTVnator',
            referer: 'https://panel.test',
            origin: 'https://panel.test',
        });
    });
});
