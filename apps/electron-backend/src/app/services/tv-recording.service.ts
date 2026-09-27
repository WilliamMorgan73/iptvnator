import { randomUUID } from 'node:crypto';
import { closeSync, createWriteStream, mkdirSync, openSync } from 'node:fs';
import type { WriteStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { finished } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import { app } from 'electron';
import path from 'path';
import { eq } from 'drizzle-orm';
import {
    PlaybackSourceKind,
    resolvePlaybackUrlSourceKind,
} from '@iptvnator/playback/util';
import type {
    RecordingStatus,
    TvRecordingStartRequest,
    TvRecordingStartResult,
} from '@iptvnator/shared/interfaces';
import { getDatabase } from '../database/connection';
import * as schema from '../database/schema';
import { broadcastRecordingsUpdate } from '../events/database/recording-broadcast';
import { requestWithValidatedRedirects } from '../util/validated-axios';

/** Synthetic sessionId prefix distinguishing a tv-mode row from an
 * Embedded-MPV one — `RECORDINGS_STOP` branches its dispatch on this. */
const TV_RECORDING_SESSION_PREFIX = 'tv:';

type RecordingFinalStatus = Extract<
    RecordingStatus,
    'completed' | 'interrupted' | 'failed'
>;

interface OpenTvRecording {
    readonly recordingId: number;
    readonly targetPath: string;
    readonly abortController: AbortController;
    readonly writeStream: WriteStream;
    stopRequested: boolean;
    finalized: boolean;
}

/**
 * tv-mode's independent live-TV recorder: a plain HTTP GET piped straight to
 * disk in the main process, entirely separate from the Embedded MPV native
 * addon (`EmbeddedMpvRecordingTracker`) tv mode does not use. A Node
 * stream's "stopped" state is synchronous and known immediately — unlike
 * mpv's async `stream-record` property set — so this needs none of that
 * tracker's settle-window/stop-acknowledgement machinery; it finalizes the
 * row directly from its own stream event handlers.
 *
 * Recording only supports a direct continuous MPEG-TS stream — the same
 * assumption the existing Xtream catch-up archive downloader makes. An HLS
 * (`.m3u8`) or DASH manifest is not a media stream itself; piping its bytes
 * to a file would just save the tiny playlist/manifest text, not the video.
 * That is a deliberate v1 gap, refused up front with a clear error rather
 * than producing a useless file.
 */
export class TvRecordingService {
    private readonly open = new Map<string, OpenTvRecording>();

    async start(
        request: TvRecordingStartRequest
    ): Promise<TvRecordingStartResult> {
        const kind = resolvePlaybackUrlSourceKind(request.streamUrl);
        if (kind !== PlaybackSourceKind.MpegTs) {
            return {
                success: false,
                error: 'Recording only supports a direct MPEG-TS stream, not an HLS or DASH manifest.',
            };
        }

        const directory = app.getPath('downloads');
        mkdirSync(directory, { recursive: true });
        let targetPath: string;
        try {
            targetPath = this.reserveTargetPath(
                directory,
                request.metadata.channelName
            );
        } catch (error) {
            return {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : 'Could not reserve a recording file',
            };
        }

        const abortController = new AbortController();
        let readable: Readable;
        try {
            const response = await requestWithValidatedRedirects<Readable>(
                request.streamUrl,
                {
                    headers: this.buildRequestHeaders(request),
                    method: 'GET',
                    responseType: 'stream',
                    decompress: false,
                    signal: abortController.signal,
                    validateStatus: (status) => status === 200,
                },
                { allowPrivateNetworks: true }
            );
            readable = response.data;
        } catch (error) {
            return {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : 'Failed to connect to the stream',
            };
        }

        const sessionId = TV_RECORDING_SESSION_PREFIX + randomUUID();
        const startedAt = new Date().toISOString();
        const db = await getDatabase();
        const insertResult = await db.insert(schema.recordings).values({
            sessionId,
            ownerPid: process.pid,
            status: 'recording',
            filePath: targetPath,
            channelName: request.metadata.channelName,
            channelLogoUrl: request.metadata.channelLogoUrl,
            playlistId: request.metadata.playlistId,
            playlistName: request.metadata.playlistName,
            sourceType: request.metadata.sourceType,
            epgChannelId: request.metadata.epgChannelId,
            programTitle: request.metadata.currentProgram?.title,
            programDescription: request.metadata.currentProgram?.description,
            programStart: request.metadata.currentProgram?.start,
            programStop: request.metadata.currentProgram?.stop,
            startedAt,
        });
        const recordingId = Number(insertResult.lastInsertRowid);

        const writeStream = createWriteStream(targetPath);
        const entry: OpenTvRecording = {
            recordingId,
            targetPath,
            abortController,
            writeStream,
            stopRequested: false,
            finalized: false,
        };
        this.open.set(sessionId, entry);

        readable.on('error', () => void this.finalize(sessionId));
        readable.on('close', () => void this.finalize(sessionId));
        writeStream.on('error', () => void this.finalize(sessionId));
        readable.pipe(writeStream);

        broadcastRecordingsUpdate();
        return { success: true, recordingId };
    }

    /** Called from `RECORDINGS_STOP` for a `tv:`-prefixed sessionId. */
    async stop(sessionId: string): Promise<void> {
        const entry = this.open.get(sessionId);
        if (!entry) {
            return;
        }
        entry.stopRequested = true;
        entry.abortController.abort();
        await this.finalize(sessionId);
    }

    /** Row ids this process is actively writing — startup recovery must
     * leave them alone, same contract as the Embedded MPV tracker's
     * `activeRowIds()`. */
    activeRowIds(): Set<number> {
        return new Set([...this.open.values()].map((entry) => entry.recordingId));
    }

    private buildRequestHeaders(
        request: TvRecordingStartRequest
    ): Record<string, string> {
        const headers: Record<string, string> = {
            ...request.headers,
            'Accept-Encoding': 'identity',
        };
        if (request.userAgent) {
            headers['User-Agent'] = request.userAgent;
        }
        if (request.referer) {
            headers['Referer'] = request.referer;
        }
        if (request.origin) {
            headers['Origin'] = request.origin;
        }
        return headers;
    }

    /**
     * Idempotent: the map delete below makes every listener after the first
     * (readable 'error'/'close', write stream 'error', an explicit stop) a
     * no-op. Waits for the write stream to actually flush before statting —
     * `readable`'s 'close' fires once its own side is done, not once every
     * buffered chunk has reached disk.
     */
    private async finalize(sessionId: string): Promise<void> {
        const entry = this.open.get(sessionId);
        if (!entry) {
            return;
        }
        this.open.delete(sessionId);

        entry.writeStream.end();
        try {
            await finished(entry.writeStream);
        } catch {
            // The write stream itself errored — fall through to the stat,
            // which will report whatever actually reached disk.
        }

        let fileSizeBytes: number | null = null;
        try {
            const stats = await stat(entry.targetPath);
            fileSizeBytes = stats.size;
        } catch {
            // Leave size null — the row still finalizes.
        }

        const status: RecordingFinalStatus =
            fileSizeBytes && fileSizeBytes > 0
                ? entry.stopRequested
                    ? 'completed'
                    : 'interrupted'
                : 'failed';

        const db = await getDatabase();
        await db
            .update(schema.recordings)
            .set({
                status,
                endedAt: new Date().toISOString(),
                fileSizeBytes,
                updatedAt: new Date().toISOString(),
            })
            .where(eq(schema.recordings.id, entry.recordingId));
        broadcastRecordingsUpdate();
    }

    private reserveTargetPath(directory: string, title: string): string {
        const baseName = this.sanitizeFileName(title);
        const timestamp = this.formatTimestamp(new Date());
        let candidate = path.join(directory, `${baseName}-${timestamp}.ts`);
        let suffix = 2;
        while (true) {
            try {
                const fd = openSync(candidate, 'wx');
                closeSync(fd);
                return candidate;
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
                    candidate = path.join(
                        directory,
                        `${baseName}-${timestamp}-${suffix}.ts`
                    );
                    suffix += 1;
                    continue;
                }
                throw error;
            }
        }
    }

    private sanitizeFileName(title: string): string {
        const normalized = title
            // eslint-disable-next-line no-control-regex
            .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
            .replace(/\s+/g, ' ')
            .trim();
        return (normalized || 'IPTVnator recording').slice(0, 120);
    }

    private formatTimestamp(date: Date): string {
        const parts = [
            date.getFullYear(),
            date.getMonth() + 1,
            date.getDate(),
            date.getHours(),
            date.getMinutes(),
            date.getSeconds(),
        ].map((part) => String(part).padStart(2, '0'));
        return `${parts[0]}${parts[1]}${parts[2]}-${parts[3]}${parts[4]}${parts[5]}`;
    }
}

export const tvRecordingService = new TvRecordingService();

/** Used by `RECORDINGS_STOP` to recognize a tv-mode row and route to this
 * service instead of `embeddedMpvNativeService.stopRecording()`. */
export function isTvRecordingSessionId(
    sessionId: string | null | undefined
): boolean {
    return (sessionId ?? '').startsWith(TV_RECORDING_SESSION_PREFIX);
}
