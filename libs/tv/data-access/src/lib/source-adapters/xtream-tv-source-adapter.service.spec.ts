import { TestBed } from '@angular/core/testing';
import { XtreamStore } from '@iptvnator/portal/xtream/data-access';
import type { PlaylistMeta } from '@iptvnator/shared/interfaces';
import { XtreamTvSourceAdapter } from './xtream-tv-source-adapter.service';

describe('XtreamTvSourceAdapter', () => {
    let fakeStore: {
        setPlaylistId: jest.Mock;
        initialize: jest.Mock;
        setSelectedContentType: jest.Mock;
        setSelectedCategory: jest.Mock;
        liveCategories: jest.Mock;
        selectItemsFromSelectedCategory: jest.Mock;
        constructStreamUrl: jest.Mock;
        currentPlaylist: jest.Mock;
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
                },
            ]),
            constructStreamUrl: jest.fn().mockReturnValue('https://stream.test/101'),
            currentPlaylist: jest.fn().mockReturnValue({
                userAgent: 'IPTVnator',
                referrer: 'https://panel.test',
                origin: 'https://panel.test',
            }),
        };

        TestBed.configureTestingModule({
            providers: [{ provide: XtreamStore, useValue: fakeStore }],
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
                },
            },
        ]);
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
