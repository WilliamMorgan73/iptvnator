import { TestBed } from '@angular/core/testing';
import { StalkerStore } from '@iptvnator/portal/stalker/data-access';
import type { PlaylistMeta } from '@iptvnator/shared/interfaces';
import { StalkerTvSourceAdapter } from './stalker-tv-source-adapter.service';

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
        };

        TestBed.configureTestingModule({
            providers: [{ provide: StalkerStore, useValue: fakeStore }],
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
});
