import { webcrypto } from 'node:crypto';
import { addStalkerSource } from './stalker-add-source';
import { stalkerSessionFingerprint } from './stalker-session-store';
import { StalkerPortalError } from './stalker-portal-error';
import type { Playlist } from '@iptvnator/shared/interfaces';

describe('addStalkerSource', () => {
    let portalDiscovery: { discover: jest.Mock };

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
        portalDiscovery = {
            discover: jest.fn().mockResolvedValue({
                status: 'resolved',
                portalUrl:
                    'https://portal.example.com/stalker_portal/server/load.php',
                isFullStalkerPortal: true,
                token: 'token-1',
            }),
        };
    });

    it('builds a playlist with the resolved cadence and account info', async () => {
        portalDiscovery.discover.mockResolvedValue({
            status: 'resolved',
            portalUrl:
                'https://portal.example.com/stalker_portal/server/load.php',
            isFullStalkerPortal: true,
            token: 'token-1',
            watchdogTimeoutSeconds: 90,
            timeslotSeconds: 11,
            accountInfo: {
                login: 'user',
                expire_date: 123,
                tariff_plan_name: 'Basic',
                status: 1,
            },
        });

        const result = await addStalkerSource(portalDiscovery, {
            id: 'playlist-cadence',
            title: 'Cadence Portal',
            macAddress: '00:1A:79:AA:BB:CC',
            portalUrl: 'https://portal.example.com/stalker_portal/c',
            importDate: '2026-05-15T00:00:00.000Z',
        });

        expect(result.status).toBe('ok');
        const playlist = (result as { playlist: Playlist }).playlist;
        expect(playlist.stalkerWatchdogTimeout).toBe(90);
        expect(playlist.stalkerTimeslot).toBe(11);
        expect(playlist.stalkerAccountInfo).toEqual({
            login: 'user',
            expireDate: 123,
            tariffPlanName: 'Basic',
            status: 1,
        });
        expect(playlist.stalkerSessionIdentity).toEqual(expect.any(String));
    });

    it('records the effective cadence and credentials when the portal advertises none', async () => {
        portalDiscovery.discover.mockResolvedValue({
            status: 'resolved',
            portalUrl:
                'https://portal.example.com/stalker_portal/server/load.php',
            isFullStalkerPortal: true,
            token: 'token-1',
        });

        const result = await addStalkerSource(portalDiscovery, {
            id: 'playlist-login-fp',
            title: 'Login Portal',
            macAddress: '00:1A:79:00:00:08',
            portalUrl: 'https://portal.example.com/stalker_portal/c',
            username: 'user',
            password: 'secret',
            importDate: '2026-05-15T00:00:00.000Z',
        });

        expect(result.status).toBe('ok');
        const playlist = (result as { playlist: Playlist }).playlist;
        // Stored absence has to keep meaning "never profiled", or every
        // later start would re-profile such a portal.
        expect(playlist.stalkerWatchdogTimeout).toBe(120);
        expect(playlist.stalkerTimeslot).toBe(0);
        // Otherwise the first runtime ensureToken() computes a fingerprint
        // WITH the credentials, mismatches the imported one, and discards
        // the session the import just established.
        expect(playlist.stalkerSessionIdentity).toBe(
            stalkerSessionFingerprint({
                portalUrl:
                    'https://portal.example.com/stalker_portal/server/load.php',
                macAddress: '00:1A:79:00:00:08',
                username: 'user',
                password: 'secret',
            } as Playlist)
        );
    });

    it('does not build a session identity when the portal issued no token', async () => {
        portalDiscovery.discover.mockResolvedValue({
            status: 'resolved',
            portalUrl: 'https://portal.example.com/server/load.php',
            isFullStalkerPortal: false,
        });

        const result = await addStalkerSource(portalDiscovery, {
            title: 'Simple Portal',
            macAddress: '00:1A:79:00:00:08',
            portalUrl: 'https://portal.example.com/c',
        });

        expect(result.status).toBe('ok');
        const playlist = (result as { playlist: Playlist }).playlist;
        expect(playlist.stalkerSessionIdentity).toBeUndefined();
        expect(playlist.stalkerToken).toBeUndefined();
    });

    it("relays the portal's own refusal instead of persisting anything", async () => {
        const error = new StalkerPortalError('login-required');
        portalDiscovery.discover.mockResolvedValue({
            status: 'auth-rejected',
            portalUrl:
                'https://portal.example.com/stalker_portal/server/load.php',
            error,
        });

        const result = await addStalkerSource(portalDiscovery, {
            title: 'Login Portal',
            macAddress: '00:1A:79:00:00:08',
            portalUrl: 'https://portal.example.com/stalker_portal/c',
        });

        expect(result).toEqual({
            status: 'auth-rejected',
            portalUrl:
                'https://portal.example.com/stalker_portal/server/load.php',
            error,
        });
    });

    it('passes through an abandoned-in-flight rejection unchanged', async () => {
        const abandonedAuthenticationSettled = Promise.resolve();
        portalDiscovery.discover.mockResolvedValue({
            status: 'auth-rejected',
            portalUrl:
                'https://portal.example.com/stalker_portal/server/load.php',
            abandonedInFlight: true,
            abandonedAuthenticationSettled,
        });

        const result = await addStalkerSource(portalDiscovery, {
            title: 'Slow Portal',
            macAddress: '00:1A:79:00:00:08',
            portalUrl: 'https://portal.example.com/stalker_portal/c',
        });

        expect(result).toMatchObject({
            status: 'auth-rejected',
            abandonedInFlight: true,
            abandonedAuthenticationSettled,
        });
    });

    it('refuses a canonical-shape URL that could not be reached', async () => {
        portalDiscovery.discover.mockResolvedValue({ status: 'unreachable' });

        const result = await addStalkerSource(portalDiscovery, {
            title: 'Canonical Portal',
            macAddress: '00:1A:79:AA:BB:CC',
            portalUrl: 'https://portal.example.com/stalker_portal/c',
        });

        expect(result).toEqual({ status: 'unreachable-refused' });
    });

    it('adds a panel-shape URL without validation, classified on the normalized URL not the raw query', async () => {
        // A query merely MENTIONING /server/load.php must not make a
        // panel-style /c URL look canonical and abort the offline import.
        portalDiscovery.discover.mockResolvedValue({ status: 'unreachable' });

        const result = await addStalkerSource(portalDiscovery, {
            title: 'Query Panel',
            macAddress: '00:1A:79:AA:BB:CC',
            portalUrl: 'https://panel.example.com/c?redirect=/server/load.php',
        });

        expect(result.status).toBe('unreachable-added');
        const playlist = (result as { playlist: Playlist }).playlist;
        expect(playlist).toEqual(
            expect.objectContaining({
                portalUrl: 'https://panel.example.com/portal.php',
                isFullStalkerPortal: false,
            })
        );
    });

    it('derives device IDs from the MAC when deriveDeviceIds is true', async () => {
        portalDiscovery.discover.mockResolvedValue({
            status: 'resolved',
            portalUrl: 'https://portal.example.com/stalker_portal/server/load.php',
            isFullStalkerPortal: true,
        });

        await addStalkerSource(portalDiscovery, {
            title: 'Derived Portal',
            macAddress: '00:1A:79:00:00:08',
            portalUrl: 'https://portal.example.com/stalker_portal/c',
            deriveDeviceIds: true,
        });

        const [, , identity] = portalDiscovery.discover.mock.calls[0];
        expect(identity.deviceId1).toEqual(expect.any(String));
        expect(identity.deviceId2).toEqual(expect.any(String));
        expect(identity.deviceId1).not.toBe(identity.deviceId2);
    });

    it('uses explicit device IDs verbatim when deriveDeviceIds is not set', async () => {
        await addStalkerSource(portalDiscovery, {
            title: 'Manual Portal',
            macAddress: '00:1A:79:00:00:08',
            portalUrl: 'https://portal.example.com/stalker_portal/c',
            deviceId1: 'manual-1',
            deviceId2: 'manual-2',
        });

        const [, , identity] = portalDiscovery.discover.mock.calls[0];
        expect(identity.deviceId1).toBe('manual-1');
        expect(identity.deviceId2).toBe('manual-2');
    });
});
