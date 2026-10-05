import type { TvLiveChannel } from './tv-live-catalog.model';
import type { TvLivePlaybackResult } from './tv-live-source-adapter';
import { buildTvRecordingRequest } from './tv-recording-request.util';

function fakeChannel(overrides: Partial<TvLiveChannel> = {}): TvLiveChannel {
    return {
        id: 'ch-1',
        name: 'Channel One',
        categoryId: 'cat-1',
        sourceKind: 'xtream',
        logoUrl: 'https://example.test/logo.png',
        playRef: null,
        ...overrides,
    };
}

const playback: TvLivePlaybackResult = {
    streamUrl: 'https://example.test/stream.m3u8',
    userAgent: 'agent',
    referer: 'https://example.test',
    origin: 'https://example.test',
    headers: { 'X-Test': '1' },
};

describe('buildTvRecordingRequest', () => {
    it('carries channel/playback/playlist identity into the request', () => {
        const request = buildTvRecordingRequest(
            fakeChannel(),
            playback,
            'playlist-1',
            'My Playlist'
        );

        expect(request).toEqual({
            metadata: {
                channelName: 'Channel One',
                channelLogoUrl: 'https://example.test/logo.png',
                playlistId: 'playlist-1',
                playlistName: 'My Playlist',
                sourceType: 'xtream',
                currentProgram: undefined,
            },
            streamUrl: playback.streamUrl,
            userAgent: playback.userAgent,
            referer: playback.referer,
            origin: playback.origin,
            headers: playback.headers,
        });
    });

    it('falls back playlist identity to undefined when null', () => {
        const request = buildTvRecordingRequest(fakeChannel(), playback, null, null);

        expect(request.metadata.playlistId).toBeUndefined();
        expect(request.metadata.playlistName).toBeUndefined();
    });

    it('includes the current program when the channel has one', () => {
        const request = buildTvRecordingRequest(
            fakeChannel({
                currentProgramTitle: 'The Show',
                currentProgramDescription: 'A description',
                currentProgramStart: '2026-01-01T00:00:00Z',
                currentProgramStop: '2026-01-01T01:00:00Z',
            }),
            playback,
            null,
            null
        );

        expect(request.metadata.currentProgram).toEqual({
            title: 'The Show',
            description: 'A description',
            start: '2026-01-01T00:00:00Z',
            stop: '2026-01-01T01:00:00Z',
        });
    });

    it('defaults missing start/stop to empty strings when a title exists', () => {
        const request = buildTvRecordingRequest(
            fakeChannel({ currentProgramTitle: 'The Show' }),
            playback,
            null,
            null
        );

        expect(request.metadata.currentProgram).toEqual({
            title: 'The Show',
            description: undefined,
            start: '',
            stop: '',
        });
    });
});
