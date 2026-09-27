import { TestBed } from '@angular/core/testing';
import { EpgRuntimeBridgeService } from '@iptvnator/epg/data-access';
import type { TvLiveChannel } from '@iptvnator/tv/util';
import { XtreamTvSourceAdapter } from '../source-adapters/xtream-tv-source-adapter.service';
import { XtreamTvEpgGuideAdapter } from './xtream-tv-epg-guide-adapter.service';

function liveChannel(
    id: string,
    overrides: Partial<TvLiveChannel> = {},
    epgChannelId?: string
): TvLiveChannel {
    return {
        id,
        name: `Channel ${id}`,
        categoryId: 'all',
        sourceKind: 'xtream',
        playRef: { epg_channel_id: epgChannelId ?? null },
        ...overrides,
    };
}

describe('XtreamTvEpgGuideAdapter', () => {
    let fakeLiveAdapter: { channelsAcrossCategories: jest.Mock };
    let getProgramsForChannels: jest.Mock;

    beforeEach(() => {
        fakeLiveAdapter = { channelsAcrossCategories: jest.fn().mockReturnValue([]) };
        getProgramsForChannels = jest.fn().mockResolvedValue(null);
        TestBed.configureTestingModule({
            providers: [
                { provide: XtreamTvSourceAdapter, useValue: fakeLiveAdapter },
                {
                    provide: EpgRuntimeBridgeService,
                    useValue: { getProgramsForChannels },
                },
            ],
        });
    });

    function createAdapter(): XtreamTvEpgGuideAdapter {
        return TestBed.inject(XtreamTvEpgGuideAdapter);
    }

    it('maps channels from channelsAcrossCategories', () => {
        fakeLiveAdapter.channelsAcrossCategories.mockReturnValue([
            liveChannel('101', { channelNumber: 101 }, 'nova.sports.1'),
        ]);

        const adapter = createAdapter();

        expect(adapter.channels()).toEqual([
            { id: '101', number: 101, name: 'Channel 101', logoUrl: null },
        ]);
    });

    it('groups requested ids by the mapped epg_channel_id', async () => {
        fakeLiveAdapter.channelsAcrossCategories.mockReturnValue([
            liveChannel('101', {}, 'nova.sports.1'),
            liveChannel('202', {}, 'cnn.news'),
        ]);
        getProgramsForChannels.mockResolvedValue({
            'nova.sports.1': [{ title: 'Match' }],
            'cnn.news': [{ title: 'News' }],
        });
        const adapter = createAdapter();

        const result = await adapter.loadPrograms({
            channelIds: ['101', '202'],
            fromMs: 0,
            toMs: 1000,
        });

        expect(getProgramsForChannels).toHaveBeenCalledWith({
            channelIds: ['nova.sports.1', 'cnn.news'],
            fromMs: 0,
            toMs: 1000,
        });
        expect(result.get('101')).toEqual([{ title: 'Match' }]);
        expect(result.get('202')).toEqual([{ title: 'News' }]);
    });

    it('renders no programme information for a channel with no XMLTV mapping', async () => {
        fakeLiveAdapter.channelsAcrossCategories.mockReturnValue([
            liveChannel('101', {}, undefined),
        ]);
        const adapter = createAdapter();

        const result = await adapter.loadPrograms({
            channelIds: ['101'],
            fromMs: 0,
            toMs: 1000,
        });

        expect(getProgramsForChannels).not.toHaveBeenCalled();
        expect(result.size).toBe(0);
    });

    it('returns an empty map when the bridge responds null', async () => {
        fakeLiveAdapter.channelsAcrossCategories.mockReturnValue([
            liveChannel('101', {}, 'nova.sports.1'),
        ]);
        getProgramsForChannels.mockResolvedValue(null);
        const adapter = createAdapter();

        const result = await adapter.loadPrograms({
            channelIds: ['101'],
            fromMs: 0,
            toMs: 1000,
        });

        expect(result.size).toBe(0);
    });
});
