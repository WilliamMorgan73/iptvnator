import type { TvRecordingStartRequest } from '@iptvnator/shared/interfaces';
import type { TvLiveChannel } from './tv-live-catalog.model';
import type { TvLivePlaybackResult } from './tv-live-source-adapter';

/**
 * Builds the recording-start payload from a channel + freshly resolved
 * playback + the active playlist's identity — pure so
 * `TvLiveScreenComponent` only has to resolve those three inputs, not also
 * carry the metadata-shaping logic inline.
 */
export function buildTvRecordingRequest(
    channel: TvLiveChannel,
    playback: TvLivePlaybackResult,
    playlistId: string | null,
    playlistTitle: string | null
): TvRecordingStartRequest {
    return {
        metadata: {
            channelName: channel.name,
            channelLogoUrl: channel.logoUrl,
            playlistId: playlistId ?? undefined,
            playlistName: playlistTitle ?? undefined,
            sourceType: channel.sourceKind,
            currentProgram: channel.currentProgramTitle
                ? {
                      title: channel.currentProgramTitle,
                      description: channel.currentProgramDescription,
                      start: channel.currentProgramStart ?? '',
                      stop: channel.currentProgramStop ?? '',
                  }
                : undefined,
        },
        streamUrl: playback.streamUrl,
        userAgent: playback.userAgent,
        referer: playback.referer,
        origin: playback.origin,
        headers: playback.headers,
    };
}
