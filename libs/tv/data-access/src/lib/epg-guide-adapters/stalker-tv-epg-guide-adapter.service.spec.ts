import { TestBed } from '@angular/core/testing';
import { StalkerStore } from '@iptvnator/portal/stalker/data-access';
import type { TvLiveChannel } from '@iptvnator/tv/util';
import { StalkerTvSourceAdapter } from '../source-adapters/stalker-tv-source-adapter.service';
import { StalkerTvEpgGuideAdapter } from './stalker-tv-epg-guide-adapter.service';

function liveChannel(
    id: string,
    overrides: Partial<TvLiveChannel> = {}
): TvLiveChannel {
    return {
        id,
        name: `Channel ${id}`,
        categoryId: '17',
        sourceKind: 'stalker',
        playRef: null,
        ...overrides,
    };
}

function program(startIso: string, stopIso: string, title: string) {
    return {
        start: startIso,
        stop: stopIso,
        channel: '',
        title,
        desc: null,
        category: null,
    };
}

describe('StalkerTvEpgGuideAdapter', () => {
    let fakeLiveAdapter: { channelsAcrossCategories: jest.Mock };
    let fakeStore: {
        ensureBulkItvEpg: jest.Mock;
        bulkItvEpgByChannel: jest.Mock;
    };

    beforeEach(() => {
        fakeLiveAdapter = { channelsAcrossCategories: jest.fn().mockReturnValue([]) };
        fakeStore = {
            ensureBulkItvEpg: jest.fn().mockResolvedValue(undefined),
            bulkItvEpgByChannel: jest.fn().mockReturnValue({}),
        };
        TestBed.configureTestingModule({
            providers: [
                { provide: StalkerTvSourceAdapter, useValue: fakeLiveAdapter },
                { provide: StalkerStore, useValue: fakeStore },
            ],
        });
    });

    function createAdapter(): StalkerTvEpgGuideAdapter {
        return TestBed.inject(StalkerTvEpgGuideAdapter);
    }

    it('maps channels from channelsAcrossCategories', () => {
        fakeLiveAdapter.channelsAcrossCategories.mockReturnValue([
            liveChannel('5001', { channelNumber: 201 }),
        ]);

        const adapter = createAdapter();

        expect(adapter.channels()).toEqual([
            { id: '5001', number: 201, name: 'Channel 5001', logoUrl: null },
        ]);
    });

    it('warms the bulk cache before reading it', async () => {
        const adapter = createAdapter();

        await adapter.loadPrograms({ channelIds: ['5001'], fromMs: 0, toMs: 1000 });

        expect(fakeStore.ensureBulkItvEpg).toHaveBeenCalledWith(168);
    });

    it('returns only programmes overlapping the requested window', async () => {
        fakeStore.bulkItvEpgByChannel.mockReturnValue({
            '5001': [
                program(
                    '2026-09-27T10:00:00.000Z',
                    '2026-09-27T11:00:00.000Z',
                    'Before window'
                ),
                program(
                    '2026-09-27T11:30:00.000Z',
                    '2026-09-27T12:30:00.000Z',
                    'Overlaps window'
                ),
                program(
                    '2026-09-27T13:00:00.000Z',
                    '2026-09-27T14:00:00.000Z',
                    'After window'
                ),
            ],
        });
        const adapter = createAdapter();
        const fromMs = Date.parse('2026-09-27T12:00:00.000Z');
        const toMs = Date.parse('2026-09-27T13:00:00.000Z');

        const result = await adapter.loadPrograms({
            channelIds: ['5001'],
            fromMs,
            toMs,
        });

        expect(result.get('5001')?.map((p) => p.title)).toEqual([
            'Overlaps window',
        ]);
    });

    it('omits a requested channel with no cached programmes', async () => {
        const adapter = createAdapter();

        const result = await adapter.loadPrograms({
            channelIds: ['5001'],
            fromMs: 0,
            toMs: 1000,
        });

        expect(result.has('5001')).toBe(false);
    });

    it('omits a channel whose cached programmes all fall outside the window', async () => {
        fakeStore.bulkItvEpgByChannel.mockReturnValue({
            '5001': [
                program(
                    '2026-09-27T01:00:00.000Z',
                    '2026-09-27T02:00:00.000Z',
                    'Way earlier'
                ),
            ],
        });
        const adapter = createAdapter();

        const result = await adapter.loadPrograms({
            channelIds: ['5001'],
            fromMs: Date.parse('2026-09-27T12:00:00.000Z'),
            toMs: Date.parse('2026-09-27T13:00:00.000Z'),
        });

        expect(result.has('5001')).toBe(false);
    });
});
