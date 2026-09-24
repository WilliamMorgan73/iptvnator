import { TestBed } from '@angular/core/testing';
import {
    PLAYLIST_PARSE_BY_URL,
    XTREAM_RESPONSE,
} from '@iptvnator/shared/interfaces';
import { TvElectronDataService } from './tv-electron-data.service';

describe('TvElectronDataService', () => {
    const original = window.electron;

    afterEach(() => {
        window.electron = original;
    });

    function createService(): TvElectronDataService {
        TestBed.configureTestingModule({});
        return TestBed.inject(TvElectronDataService);
    }

    it('forwards XTREAM_REQUEST to window.electron.xtreamRequest and reshapes the response', async () => {
        const xtreamRequest = jest
            .fn()
            .mockResolvedValue({ payload: { foo: 'bar' }, action: 'get_live_categories' });
        window.electron = {
            xtreamRequest,
        } as unknown as typeof window.electron;

        const service = createService();
        const result = await service.sendIpcEvent('XTREAM_REQUEST', {
            url: 'https://panel.test',
            params: { action: 'get_live_categories' },
        });

        expect(xtreamRequest).toHaveBeenCalledWith({
            url: 'https://panel.test',
            params: { action: 'get_live_categories' },
        });
        expect(result).toEqual({
            type: XTREAM_RESPONSE,
            payload: { foo: 'bar' },
            action: 'get_live_categories',
        });
    });

    it('forwards STALKER_REQUEST to window.electron.stalkerRequest as-is', async () => {
        const stalkerRequest = jest
            .fn()
            .mockResolvedValue({ js: { data: [] } });
        window.electron = {
            stalkerRequest,
        } as unknown as typeof window.electron;

        const service = createService();
        const payload = {
            url: 'https://portal.test/c',
            macAddress: '00:1A:79:00:00:00',
            params: { action: 'get_genres' },
        };
        const result = await service.sendIpcEvent('STALKER_REQUEST', payload);

        expect(stalkerRequest).toHaveBeenCalledWith(payload);
        expect(result).toEqual({ js: { data: [] } });
    });

    it('resets the connectivity guard for the given url', async () => {
        const resetHostConnectivityGuard = jest.fn().mockResolvedValue(undefined);
        window.electron = {
            resetHostConnectivityGuard,
        } as unknown as typeof window.electron;

        const service = createService();
        await service.sendIpcEvent('CONNECTIVITY_GUARD_RESET', {
            url: 'https://panel.test',
        });

        expect(resetHostConnectivityGuard).toHaveBeenCalledWith(
            'https://panel.test'
        );
    });

    it('forwards PLAYLIST_PARSE_BY_URL to window.electron.fetchPlaylistByUrl and returns the fetched playlist', async () => {
        const playlist = { _id: 'p1', title: 'Fetched', url: 'https://example.test/list.m3u' };
        const fetchPlaylistByUrl = jest.fn().mockResolvedValue(playlist);
        window.electron = {
            fetchPlaylistByUrl,
        } as unknown as typeof window.electron;

        const service = createService();
        const result = await service.sendIpcEvent(PLAYLIST_PARSE_BY_URL, {
            url: 'https://example.test/list.m3u',
            title: 'My List',
            userAgent: 'custom-agent',
        });

        expect(fetchPlaylistByUrl).toHaveBeenCalledWith(
            'https://example.test/list.m3u',
            'My List',
            { userAgent: 'custom-agent' }
        );
        expect(result).toBe(playlist);
    });

    it('throws for PLAYLIST_PARSE_BY_URL with no url', async () => {
        const service = createService();
        await expect(
            service.sendIpcEvent(PLAYLIST_PARSE_BY_URL, { title: 'No URL' })
        ).rejects.toThrow('PLAYLIST_PARSE_BY_URL requires a url');
    });

    it('returns undefined for an unhandled event type without throwing', async () => {
        const service = createService();
        const result = await service.sendIpcEvent('SOME_OTHER_EVENT', {});
        expect(result).toBeUndefined();
    });
});
