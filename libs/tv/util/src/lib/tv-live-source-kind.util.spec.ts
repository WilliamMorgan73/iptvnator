import type { PlaylistMeta } from '@iptvnator/shared/interfaces';
import { resolveTvLiveSourceKind } from './tv-live-source-kind.util';

function playlistMeta(overrides: Partial<PlaylistMeta>): PlaylistMeta {
    return {
        _id: 'p1',
        title: 'Test',
        count: 0,
        importDate: '',
        ...overrides,
    } as PlaylistMeta;
}

describe('resolveTvLiveSourceKind', () => {
    it('resolves xtream when server/username/password are set', () => {
        const playlist = playlistMeta({
            serverUrl: 'https://panel.test',
            username: 'user',
            password: 'pass',
        });
        expect(resolveTvLiveSourceKind(playlist)).toBe('xtream');
    });

    it('resolves stalker when portalUrl/macAddress are set', () => {
        const playlist = playlistMeta({
            portalUrl: 'https://portal.test/c',
            macAddress: '00:1A:79:00:00:00',
        });
        expect(resolveTvLiveSourceKind(playlist)).toBe('stalker');
    });

    it('falls back to m3u for anything else', () => {
        const playlist = playlistMeta({ url: 'https://example.test/list.m3u' });
        expect(resolveTvLiveSourceKind(playlist)).toBe('m3u');
    });

    it('prefers xtream when a playlist somehow carries both credential sets', () => {
        const playlist = playlistMeta({
            serverUrl: 'https://panel.test',
            username: 'user',
            password: 'pass',
            portalUrl: 'https://portal.test/c',
            macAddress: '00:1A:79:00:00:00',
        });
        expect(resolveTvLiveSourceKind(playlist)).toBe('xtream');
    });
});
