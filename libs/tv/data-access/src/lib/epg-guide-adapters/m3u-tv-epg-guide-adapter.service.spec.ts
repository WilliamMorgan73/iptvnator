import { TestBed } from '@angular/core/testing';
import { EpgRuntimeBridgeService } from '@iptvnator/epg/data-access';
import type { Channel } from '@iptvnator/shared/interfaces';
import type { TvLiveChannel } from '@iptvnator/tv/util';
import { M3uTvSourceAdapter } from '../source-adapters/m3u-tv-source-adapter.service';
import { M3uTvEpgGuideAdapter } from './m3u-tv-epg-guide-adapter.service';

function channel(overrides: Partial<Channel>): Channel {
    return {
        id: 'ch1',
        url: 'https://stream.test/a.m3u8',
        name: 'Channel',
        group: { title: '' },
        tvg: { id: '', name: '', url: '', logo: '', rec: '' },
        http: { referrer: '', 'user-agent': '', origin: '' },
        radio: 'false',
        ...overrides,
    } as Channel;
}

function liveChannel(
    id: string,
    playRef: Channel,
    overrides: Partial<TvLiveChannel> = {}
): TvLiveChannel {
    return {
        id,
        name: playRef.name,
        categoryId: 'all',
        sourceKind: 'm3u',
        logoUrl: playRef.tvg?.logo || undefined,
        playRef,
        ...overrides,
    };
}

describe('M3uTvEpgGuideAdapter', () => {
    let fakeLiveAdapter: { channelsAcrossCategories: jest.Mock };
    let getProgramsForChannels: jest.Mock;

    beforeEach(() => {
        fakeLiveAdapter = { channelsAcrossCategories: jest.fn().mockReturnValue([]) };
        getProgramsForChannels = jest.fn().mockResolvedValue(null);
        TestBed.configureTestingModule({
            providers: [
                { provide: M3uTvSourceAdapter, useValue: fakeLiveAdapter },
                {
                    provide: EpgRuntimeBridgeService,
                    useValue: { getProgramsForChannels },
                },
            ],
        });
    });

    function createAdapter(): M3uTvEpgGuideAdapter {
        return TestBed.inject(M3uTvEpgGuideAdapter);
    }

    it('maps channels from channelsAcrossCategories, real number first then position', () => {
        fakeLiveAdapter.channelsAcrossCategories.mockReturnValue([
            liveChannel('a', channel({ name: 'A' })),
            liveChannel('b', channel({ name: 'B' })),
        ]);

        const adapter = createAdapter();

        expect(adapter.channels()).toEqual([
            { id: 'a', number: 1, name: 'A', logoUrl: null },
            { id: 'b', number: 2, name: 'B', logoUrl: null },
        ]);
    });

    it('groups requested ids by lookup key and fans the response back out', async () => {
        fakeLiveAdapter.channelsAcrossCategories.mockReturnValue([
            liveChannel('a', channel({ name: 'A', tvg: { id: 'tvg-a', name: '', url: '', logo: '', rec: '' } })),
            liveChannel('b', channel({ name: 'B', tvg: { id: 'tvg-b', name: '', url: '', logo: '', rec: '' } })),
        ]);
        getProgramsForChannels.mockResolvedValue({
            'tvg-a': [{ title: 'Show A' }],
            'tvg-b': [{ title: 'Show B' }],
        });
        const adapter = createAdapter();

        const result = await adapter.loadPrograms({
            channelIds: ['a', 'b'],
            fromMs: 0,
            toMs: 1000,
        });

        expect(getProgramsForChannels).toHaveBeenCalledWith({
            channelIds: ['tvg-a', 'tvg-b'],
            fromMs: 0,
            toMs: 1000,
        });
        expect(result.get('a')).toEqual([{ title: 'Show A' }]);
        expect(result.get('b')).toEqual([{ title: 'Show B' }]);
    });

    it('skips channels with no resolvable lookup key', async () => {
        fakeLiveAdapter.channelsAcrossCategories.mockReturnValue([
            liveChannel('a', channel({ name: '' , tvg: { id: '', name: '', url: '', logo: '', rec: '' } })),
        ]);
        const adapter = createAdapter();

        const result = await adapter.loadPrograms({
            channelIds: ['a'],
            fromMs: 0,
            toMs: 1000,
        });

        expect(getProgramsForChannels).not.toHaveBeenCalled();
        expect(result.size).toBe(0);
    });

    it('only requests channels actually in the window, not the whole catalog', async () => {
        fakeLiveAdapter.channelsAcrossCategories.mockReturnValue([
            liveChannel('a', channel({ name: 'A', tvg: { id: 'tvg-a', name: '', url: '', logo: '', rec: '' } })),
            liveChannel('b', channel({ name: 'B', tvg: { id: 'tvg-b', name: '', url: '', logo: '', rec: '' } })),
        ]);
        getProgramsForChannels.mockResolvedValue({ 'tvg-a': [] });
        const adapter = createAdapter();

        await adapter.loadPrograms({ channelIds: ['a'], fromMs: 0, toMs: 1000 });

        expect(getProgramsForChannels).toHaveBeenCalledWith(
            expect.objectContaining({ channelIds: ['tvg-a'] })
        );
    });

    it('returns an empty map when the bridge responds null', async () => {
        fakeLiveAdapter.channelsAcrossCategories.mockReturnValue([
            liveChannel('a', channel({ tvg: { id: 'tvg-a', name: '', url: '', logo: '', rec: '' } })),
        ]);
        getProgramsForChannels.mockResolvedValue(null);
        const adapter = createAdapter();

        const result = await adapter.loadPrograms({
            channelIds: ['a'],
            fromMs: 0,
            toMs: 1000,
        });

        expect(result.size).toBe(0);
    });
});
