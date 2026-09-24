import { webcrypto } from 'node:crypto';
import { TestBed } from '@angular/core/testing';
import { DataService, PlaylistsService } from '@iptvnator/services';
import {
    StalkerPortalDiscoveryService,
    StalkerPortalError,
} from '@iptvnator/portal/stalker/data-access';
import { of } from 'rxjs';
import { TvAddSourceService } from './tv-add-source.service';

describe('TvAddSourceService', () => {
    let addPlaylist: jest.Mock;
    let sendIpcEvent: jest.Mock;
    let discover: jest.Mock;

    // jsdom ships no WebCrypto; the Stalker "derive device IDs" path needs
    // SHA-256, same setup as stalker-add-source.spec.ts.
    const originalCrypto = globalThis.crypto;
    beforeAll(() => {
        Object.defineProperty(globalThis, 'crypto', {
            configurable: true,
            value: webcrypto,
        });
    });
    afterAll(() => {
        Object.defineProperty(globalThis, 'crypto', {
            configurable: true,
            value: originalCrypto,
        });
    });

    beforeEach(() => {
        addPlaylist = jest.fn((playlist) => of(playlist));
        sendIpcEvent = jest.fn();
        discover = jest.fn();

        TestBed.configureTestingModule({
            providers: [
                { provide: PlaylistsService, useValue: { addPlaylist } },
                { provide: DataService, useValue: { sendIpcEvent } },
                {
                    provide: StalkerPortalDiscoveryService,
                    useValue: { discover },
                },
            ],
        });
    });

    function createService(): TvAddSourceService {
        return TestBed.inject(TvAddSourceService);
    }

    describe('xtream', () => {
        it('normalizes the server URL, persists, and returns the playlist', async () => {
            const service = createService();

            const outcome = await service.addSource('xtream', {
                title: 'My Panel',
                serverUrl: 'https://panel.test/',
                username: 'user',
                password: 'pass',
            });

            expect(outcome.kind).toBe('added');
            expect(addPlaylist).toHaveBeenCalledTimes(1);
            const playlist = addPlaylist.mock.calls[0][0];
            expect(playlist.serverUrl).toBe('https://panel.test');
            expect(playlist.title).toBe('My Panel');
            expect(playlist.count).toBe(0);
            expect(playlist.autoRefresh).toBe(false);
            expect(playlist.importDate).toEqual(expect.any(String));
        });

        it('rejects an invalid server URL without persisting', async () => {
            const service = createService();

            const outcome = await service.addSource('xtream', {
                title: 'Bad',
                serverUrl: 'not a url',
                username: '',
                password: '',
            });

            expect(outcome).toEqual({
                kind: 'rejected',
                message: expect.any(String),
            });
            expect(addPlaylist).not.toHaveBeenCalled();
        });
    });

    describe('stalker', () => {
        it('rejects an invalid MAC address without probing the portal', async () => {
            const service = createService();

            const outcome = await service.addSource('stalker', {
                title: 'Portal',
                portalUrl: 'https://portal.test/c',
                macAddress: 'not-a-mac',
            });

            expect(outcome).toEqual({
                kind: 'rejected',
                message: 'Enter a valid MAC address.',
            });
            expect(discover).not.toHaveBeenCalled();
        });

        it('rejects a blank portal URL without probing', async () => {
            const service = createService();

            const outcome = await service.addSource('stalker', {
                title: 'Portal',
                portalUrl: '',
                macAddress: '00:1A:79:00:00:00',
            });

            expect(outcome).toEqual({
                kind: 'rejected',
                message: 'Enter a portal URL.',
            });
            expect(discover).not.toHaveBeenCalled();
        });

        it('persists the resolved playlist with bookkeeping fields on success', async () => {
            discover.mockResolvedValue({
                status: 'resolved',
                portalUrl: 'https://portal.test/server/load.php',
                isFullStalkerPortal: true,
            });
            const service = createService();

            const outcome = await service.addSource('stalker', {
                title: 'Portal',
                portalUrl: 'https://portal.test/c',
                macAddress: '00:1A:79:00:00:00',
            });

            expect(outcome.kind).toBe('added');
            const playlist = addPlaylist.mock.calls[0][0];
            expect(playlist.macAddress).toBe('00:1A:79:00:00:00');
            expect(playlist.count).toBe(0);
            expect(playlist.importDate).toEqual(expect.any(String));
        });

        it('derives device IDs from the MAC (tv mode has no manual device-ID UI)', async () => {
            discover.mockResolvedValue({
                status: 'resolved',
                portalUrl: 'https://portal.test/server/load.php',
                isFullStalkerPortal: true,
            });
            const service = createService();

            await service.addSource('stalker', {
                title: 'Portal',
                portalUrl: 'https://portal.test/c',
                macAddress: '00:1A:79:00:00:00',
            });

            const [, , identity] = discover.mock.calls[0];
            expect(identity.deviceId1).toEqual(expect.any(String));
            expect(identity.deviceId1.length).toBeGreaterThan(0);
        });

        it('relays the portal-specific message on auth rejection', async () => {
            discover.mockResolvedValue({
                status: 'auth-rejected',
                portalUrl: 'https://portal.test/server/load.php',
                error: new StalkerPortalError('device-conflict'),
            });
            const service = createService();

            const outcome = await service.addSource('stalker', {
                title: 'Portal',
                portalUrl: 'https://portal.test/c',
                macAddress: '00:1A:79:00:00:00',
            });

            expect(outcome).toEqual({
                kind: 'rejected',
                message:
                    'This MAC address is already registered to another device.',
            });
            expect(addPlaylist).not.toHaveBeenCalled();
        });

        it('waits for an abandoned in-flight authentication to settle before returning, so an immediate retry cannot race it', async () => {
            let settled = false;
            const abandonedAuthenticationSettled = new Promise<void>(
                (resolve) =>
                    setTimeout(() => {
                        settled = true;
                        resolve();
                    }, 0)
            );
            discover.mockResolvedValue({
                status: 'auth-rejected',
                portalUrl: 'https://portal.test/server/load.php',
                error: new StalkerPortalError('login-rejected'),
                abandonedInFlight: true,
                abandonedAuthenticationSettled,
            });
            const service = createService();

            await service.addSource('stalker', {
                title: 'Portal',
                portalUrl: 'https://portal.test/c',
                macAddress: '00:1A:79:00:00:00',
            });

            expect(settled).toBe(true);
        });

        it('rejects with a generic message when the portal is unreachable on a canonical URL', async () => {
            discover.mockResolvedValue({ status: 'unreachable' });
            const service = createService();

            const outcome = await service.addSource('stalker', {
                title: 'Portal',
                portalUrl: 'https://portal.test/stalker_portal/c',
                macAddress: '00:1A:79:00:00:00',
            });

            expect(outcome).toEqual({
                kind: 'rejected',
                message:
                    'Could not reach the portal. Check the URL and MAC address.',
            });
            expect(addPlaylist).not.toHaveBeenCalled();
        });

        it('persists a legacy panel URL added without validation', async () => {
            discover.mockResolvedValue({ status: 'unreachable' });
            const service = createService();

            const outcome = await service.addSource('stalker', {
                title: 'Panel',
                portalUrl: 'https://panel.test/c',
                macAddress: '00:1A:79:00:00:00',
            });

            expect(outcome.kind).toBe('added');
            expect(addPlaylist).toHaveBeenCalledTimes(1);
        });
    });

    describe('m3u', () => {
        it('rejects a blank URL without calling the data service', async () => {
            const service = createService();

            const outcome = await service.addSource('m3u', {
                title: 'List',
                url: '',
            });

            expect(outcome).toEqual({
                kind: 'rejected',
                message: 'Enter a playlist URL.',
            });
            expect(sendIpcEvent).not.toHaveBeenCalled();
        });

        it('fetches via the data service and persists the returned playlist', async () => {
            const fetched = { _id: 'p1', title: 'Fetched', url: 'https://x.test/l.m3u' };
            sendIpcEvent.mockResolvedValue(fetched);
            const service = createService();

            const outcome = await service.addSource('m3u', {
                title: 'My List',
                url: 'https://x.test/l.m3u',
            });

            expect(outcome).toEqual({ kind: 'added', playlist: fetched });
            expect(sendIpcEvent).toHaveBeenCalledWith(
                'PLAYLIST:PARSE_PLAYLIST_BY_URL',
                { url: 'https://x.test/l.m3u', title: 'My List' }
            );
            expect(addPlaylist).toHaveBeenCalledWith(fetched);
        });

        it('rejects with a generic message when the fetch fails', async () => {
            sendIpcEvent.mockRejectedValue(new Error('network error'));
            const service = createService();

            const outcome = await service.addSource('m3u', {
                title: 'List',
                url: 'https://x.test/l.m3u',
            });

            expect(outcome).toEqual({
                kind: 'rejected',
                message: 'Could not load the playlist from that URL.',
            });
            expect(addPlaylist).not.toHaveBeenCalled();
        });
    });
});
