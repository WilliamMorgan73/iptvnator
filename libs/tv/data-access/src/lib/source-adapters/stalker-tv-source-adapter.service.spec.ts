import { TestBed } from '@angular/core/testing';
import {
    StalkerItvCacheService,
    StalkerStore,
} from '@iptvnator/portal/stalker/data-access';
import { PlaylistsService, SettingsStore } from '@iptvnator/services';
import type { EpgItem, PlaylistMeta } from '@iptvnator/shared/interfaces';
import { of } from 'rxjs';
import { StalkerTvSourceAdapter } from './stalker-tv-source-adapter.service';

/**
 * `TestBed.flushEffects()` runs the constructor `effect()`'s synchronous
 * body (queueing `StalkerEpgPreviewQueue.sync()`'s fire-and-forget
 * `processQueue()`); the awaited microtask ticks after it let that queue's
 * first dispatched fetch (no leading pacing delay — the queue's 200ms
 * `delayMs` only gates the *next* dispatch, not the first) resolve and
 * commit through `onPrograms`.
 */
async function flushEffects(): Promise<void> {
    TestBed.flushEffects();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
}

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
        channel_id: '5001',
        start_timestamp: String(Math.floor((Date.now() - 60_000) / 1000)),
        stop_timestamp: String(Math.floor((Date.now() + 60_000) / 1000)),
        ...overrides,
    };
}

describe('StalkerTvSourceAdapter', () => {
    let fakeStore: {
        setCurrentPlaylist: jest.Mock;
        setSelectedContentType: jest.Mock;
        preloadItvChannels: jest.Mock;
        setSelectedCategory: jest.Mock;
        selectedCategoryId: jest.Mock;
        getCategoryResource: jest.Mock;
        itvChannels: jest.Mock;
        resolveItvPlayback: jest.Mock;
        fetchChannelEpg: jest.Mock;
    };
    let fakeItvCache: {
        getChannels: jest.Mock;
        ensureLoaded: jest.Mock;
    };
    let fakePlaylistsService: {
        addPortalRecentlyViewed: jest.Mock;
        getPortalRecentlyViewed: jest.Mock;
    };

    beforeEach(() => {
        fakeStore = {
            setCurrentPlaylist: jest.fn().mockResolvedValue(undefined),
            setSelectedContentType: jest.fn(),
            preloadItvChannels: jest.fn(),
            setSelectedCategory: jest.fn(),
            selectedCategoryId: jest.fn().mockReturnValue('17'),
            getCategoryResource: jest.fn().mockReturnValue([
                { category_id: '*', category_name: 'All' },
                { category_id: '17', category_name: 'Sports' },
            ]),
            itvChannels: jest.fn().mockReturnValue([
                {
                    id: '5001',
                    cmd: 'ffrt3 http://portal.test/ch/5001_',
                    name: 'World News 1',
                    logo: 'https://example.test/logo.png',
                    number: '201',
                },
                { id: '5002', cmd: 'ffrt3 ...', o_name: 'Fallback Name' },
            ]),
            resolveItvPlayback: jest.fn().mockResolvedValue({
                streamUrl: 'https://stream.test/5001',
                userAgent: 'IPTVnator',
                referer: 'https://portal.test',
                origin: 'https://portal.test',
            }),
            fetchChannelEpg: jest.fn().mockResolvedValue([]),
        };
        fakeItvCache = {
            getChannels: jest.fn().mockReturnValue(null),
            ensureLoaded: jest.fn().mockResolvedValue(undefined),
        };
        fakePlaylistsService = {
            addPortalRecentlyViewed: jest.fn().mockReturnValue(of(undefined)),
            getPortalRecentlyViewed: jest.fn().mockReturnValue(of([])),
        };

        TestBed.configureTestingModule({
            providers: [
                { provide: StalkerStore, useValue: fakeStore },
                { provide: StalkerItvCacheService, useValue: fakeItvCache },
                {
                    provide: PlaylistsService,
                    useValue: fakePlaylistsService,
                },
                {
                    provide: SettingsStore,
                    useValue: { resolvedEpgOffsetMinutes: () => 0 },
                },
            ],
        });
    });

    function createAdapter(): StalkerTvSourceAdapter {
        return TestBed.inject(StalkerTvSourceAdapter);
    }

    it('sets the playlist, switches to itv, and preloads the full channel list', async () => {
        const adapter = createAdapter();
        const playlist = { _id: 'p1' } as PlaylistMeta;

        await adapter.initialize(playlist);

        expect(fakeStore.setCurrentPlaylist).toHaveBeenCalledWith(playlist);
        expect(fakeStore.setSelectedContentType).toHaveBeenCalledWith('itv');
        expect(fakeStore.preloadItvChannels).toHaveBeenCalledTimes(1);
        expect(fakeItvCache.ensureLoaded).toHaveBeenCalledWith(playlist);
    });

    it('passes through the portal-native All (*) category unchanged', () => {
        const adapter = createAdapter();
        expect(adapter.categories()).toEqual([
            { id: '*', name: 'All' },
            { id: '17', name: 'Sports' },
        ]);
    });

    it('selectCategory passes the id straight through', () => {
        const adapter = createAdapter();
        adapter.selectCategory('*');
        expect(fakeStore.setSelectedCategory).toHaveBeenCalledWith('*');
    });

    it('maps store channels, falling back to o_name and skipping unnamed rows', () => {
        const adapter = createAdapter();
        expect(adapter.channels()).toEqual([
            {
                id: '5001',
                name: 'World News 1',
                categoryId: '17',
                sourceKind: 'stalker',
                logoUrl: 'https://example.test/logo.png',
                channelNumber: 201,
                playRef: fakeStore.itvChannels()[0],
            },
            {
                id: '5002',
                name: 'Fallback Name',
                categoryId: '17',
                sourceKind: 'stalker',
                logoUrl: undefined,
                channelNumber: undefined,
                playRef: fakeStore.itvChannels()[1],
            },
        ]);
    });

    describe('channelsAcrossCategories', () => {
        it('falls back to the current category while the full-list cache is not ready', async () => {
            const adapter = createAdapter();
            await adapter.initialize({ _id: 'p1' } as PlaylistMeta);

            expect(
                adapter.channelsAcrossCategories().map((c) => c.id)
            ).toEqual(['5001', '5002']);
        });

        it('uses the cached full list, attributing each channel to its own tv_genre_id', async () => {
            fakeItvCache.getChannels.mockReturnValue([
                {
                    id: '5001',
                    cmd: 'ffrt3 ...',
                    name: 'World News 1',
                    number: '201',
                    tv_genre_id: '17',
                },
                {
                    id: '9001',
                    cmd: 'ffrt3 ...',
                    name: 'Another Category Channel',
                    tv_genre_id: '99',
                },
            ]);
            const adapter = createAdapter();
            await adapter.initialize({ _id: 'p1' } as PlaylistMeta);

            const channels = adapter.channelsAcrossCategories();

            expect(channels.map((c) => c.id)).toEqual(['5001', '9001']);
            expect(channels[1].categoryId).toBe('99');
        });
    });

    describe('recently viewed', () => {
        it('persists a confirmed activation to the shared recently_viewed column', async () => {
            const adapter = createAdapter();
            await adapter.initialize({ _id: 'p1' } as PlaylistMeta);
            const [channel] = adapter.channels();

            adapter.recordRecentlyViewed?.(channel);

            expect(
                fakePlaylistsService.addPortalRecentlyViewed
            ).toHaveBeenCalledWith(
                'p1',
                expect.objectContaining({
                    id: '5001',
                    title: 'World News 1',
                    category_id: 'itv',
                })
            );
        });

        it('maps cached recent ids back to full TvLiveChannel objects, most-recent-first', async () => {
            fakePlaylistsService.getPortalRecentlyViewed.mockReturnValue(
                of([
                    { id: '5002', category_id: 'itv' },
                    { id: '5001', category_id: 'itv' },
                ])
            );
            const adapter = createAdapter();
            await adapter.initialize({ _id: 'p1' } as PlaylistMeta);
            await Promise.resolve();
            await Promise.resolve();

            expect(adapter.recentChannels?.().map((c) => c.id)).toEqual([
                '5002',
                '5001',
            ]);
        });

        it('excludes a non-live entry from the shared recently_viewed column', async () => {
            fakePlaylistsService.getPortalRecentlyViewed.mockReturnValue(
                of([
                    { id: '5001', category_id: 'itv' },
                    { id: 'vod-1', category_id: 'vod' },
                ])
            );
            const adapter = createAdapter();
            await adapter.initialize({ _id: 'p1' } as PlaylistMeta);
            await Promise.resolve();
            await Promise.resolve();

            expect(adapter.recentChannels?.().map((c) => c.id)).toEqual([
                '5001',
            ]);
        });

        it('omits a recent channel no longer present in the catalog', async () => {
            fakePlaylistsService.getPortalRecentlyViewed.mockReturnValue(
                of([{ id: 'gone', category_id: 'itv' }])
            );
            const adapter = createAdapter();
            await adapter.initialize({ _id: 'p1' } as PlaylistMeta);
            await Promise.resolve();
            await Promise.resolve();

            expect(adapter.recentChannels?.()).toEqual([]);
        });
    });

    it('resolves playback via resolveItvPlayback', async () => {
        const adapter = createAdapter();
        const [channel] = adapter.channels();

        const playback = await adapter.resolvePlayback(channel);

        expect(fakeStore.resolveItvPlayback).toHaveBeenCalledWith(
            channel.playRef
        );
        expect(playback).toEqual({
            streamUrl: 'https://stream.test/5001',
            userAgent: 'IPTVnator',
            referer: 'https://portal.test',
            origin: 'https://portal.test',
            headers: undefined,
        });
    });

    it('propagates the nothing_to_play rejection', async () => {
        fakeStore.resolveItvPlayback.mockRejectedValue(
            new Error('nothing_to_play')
        );
        const adapter = createAdapter();
        const [channel] = adapter.channels();

        await expect(adapter.resolvePlayback(channel)).rejects.toThrow(
            'nothing_to_play'
        );
    });

    describe('EPG population', () => {
        it('fetches short EPG for the visible channels via an effect over itvChannels', async () => {
            fakeStore.fetchChannelEpg.mockResolvedValue([epgItem()]);
            createAdapter();

            await flushEffects();

            // Only the first dispatched channel is asserted here — the
            // queue deliberately paces subsequent dispatches 200ms apart
            // (real timers), which is StalkerEpgPreviewQueue's own tested
            // behavior, not this adapter's wiring.
            expect(fakeStore.fetchChannelEpg).toHaveBeenCalledWith(
                '5001',
                expect.any(Number)
            );
        });

        it('leaves the current-programme fields unset before the fetch resolves', () => {
            const adapter = createAdapter();
            const [channel] = adapter.channels();

            expect(channel.currentProgramTitle).toBeUndefined();
        });

        it('populates current-programme fields once the short EPG resolves', async () => {
            fakeStore.fetchChannelEpg.mockImplementation(
                async (channelId: string) =>
                    channelId === '5001' ? [epgItem()] : []
            );
            const adapter = createAdapter();

            await flushEffects();
            const [channel] = adapter.channels();

            expect(channel.currentProgramTitle).toBe('Now Playing');
            expect(channel.currentProgramDescription).toBe('A description.');
            expect(channel.currentProgramProgress).toBeGreaterThan(0);
            expect(channel.currentProgramProgress).toBeLessThan(1);
        });
    });
});
