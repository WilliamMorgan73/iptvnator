import type { RecordingStartMetadata } from './recording-metadata.interface';

/**
 * Start request for tv-mode's live-TV recorder (`apps/electron-backend`'s
 * `TvRecordingService`) — a plain HTTP GET piped to disk in the main
 * process, independent of the Embedded MPV native addon tv mode doesn't use.
 * `metadata` is the same `RecordingStartMetadata` desktop's Embedded MPV
 * recorder snapshots at start time, so both writers persist into the
 * `recordings` table identically.
 */
export interface TvRecordingStartRequest {
    readonly metadata: RecordingStartMetadata;
    readonly streamUrl: string;
    readonly userAgent?: string;
    readonly referer?: string;
    readonly origin?: string;
    readonly headers?: Readonly<Record<string, string>>;
}

export type TvRecordingStartResult =
    | { success: true; recordingId: number }
    | { success: false; error: string };
