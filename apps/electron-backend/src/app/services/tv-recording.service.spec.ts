import { PassThrough, Writable } from 'node:stream';
import type { TvRecordingStartRequest } from '@iptvnator/shared/interfaces';

const mockGetDatabase = jest.fn();
const mockBroadcast = jest.fn();
const mockRequest = jest.fn();
const mockStat = jest.fn();
const mockOpenSync = jest.fn();
const mockCloseSync = jest.fn();
const mockMkdirSync = jest.fn();
const mockCreateWriteStream = jest.fn();
const mockGetPath = jest.fn((_name: string) => '/downloads');

jest.mock('electron', () => ({
    app: { getPath: (name: string) => mockGetPath(name) },
}));
jest.mock('../database/connection', () => ({
    getDatabase: (...args: unknown[]) => mockGetDatabase(...args),
}));
jest.mock('../events/database/recording-broadcast', () => ({
    broadcastRecordingsUpdate: (...args: unknown[]) => mockBroadcast(...args),
}));
jest.mock('../util/validated-axios', () => ({
    requestWithValidatedRedirects: (...args: unknown[]) =>
        mockRequest(...args),
}));
jest.mock('node:fs', () => ({
    ...jest.requireActual<typeof import('node:fs')>('node:fs'),
    openSync: (...args: unknown[]) => mockOpenSync(...args),
    closeSync: (...args: unknown[]) => mockCloseSync(...args),
    mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
    createWriteStream: (...args: unknown[]) => mockCreateWriteStream(...args),
}));
jest.mock('node:fs/promises', () => ({
    ...jest.requireActual<typeof import('node:fs/promises')>(
        'node:fs/promises'
    ),
    stat: (...args: unknown[]) => mockStat(...args),
}));

import { TvRecordingService } from './tv-recording.service';

interface DbHarness {
    insertValues: jest.Mock;
    updateSet: jest.Mock;
    updateWhere: jest.Mock;
}

function mockDb(): DbHarness {
    const insertValues = jest
        .fn()
        .mockResolvedValue({ lastInsertRowid: BigInt(9) });
    const updateWhere = jest.fn().mockResolvedValue(undefined);
    const updateSet = jest.fn(() => ({ where: updateWhere }));
    const db = {
        insert: jest.fn(() => ({ values: insertValues })),
        update: jest.fn(() => ({ set: updateSet })),
    };
    mockGetDatabase.mockResolvedValue(db);
    return { insertValues, updateSet, updateWhere };
}

/** A real Writable, so the service's own `finished()` await observes real
 * 'finish'/'error' events instead of needing that promise mocked too. */
function fakeWriteStream(): Writable {
    return new Writable({
        write(_chunk, _encoding, callback) {
            callback();
        },
    });
}

function request(
    overrides: Partial<TvRecordingStartRequest> = {}
): TvRecordingStartRequest {
    return {
        metadata: { channelName: 'Nova Sports 1' },
        streamUrl: 'https://stream.test/live/1',
        ...overrides,
    };
}

describe('TvRecordingService', () => {
    let service: TvRecordingService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new TvRecordingService();
        mockOpenSync.mockReturnValue(3);
        mockCreateWriteStream.mockImplementation(() => fakeWriteStream());
    });

    it('refuses an HLS manifest without touching the network', async () => {
        mockDb();

        const result = await service.start(
            request({ streamUrl: 'https://stream.test/live.m3u8' })
        );

        expect(result).toEqual({
            success: false,
            error: expect.stringContaining('MPEG-TS'),
        });
        expect(mockRequest).not.toHaveBeenCalled();
    });

    it('refuses a DASH manifest without touching the network', async () => {
        const result = await service.start(
            request({ streamUrl: 'https://stream.test/live.mpd' })
        );

        expect(result.success).toBe(false);
        expect(mockRequest).not.toHaveBeenCalled();
    });

    it('starts a recording for a direct MPEG-TS stream, inserting a tv:-prefixed row', async () => {
        const { insertValues } = mockDb();
        const readable = new PassThrough();
        mockRequest.mockResolvedValue({ data: readable });

        const result = await service.start(request());

        expect(result).toEqual({ success: true, recordingId: 9 });
        expect(insertValues).toHaveBeenCalledWith(
            expect.objectContaining({
                sessionId: expect.stringMatching(/^tv:/),
                status: 'recording',
                channelName: 'Nova Sports 1',
                filePath: expect.stringContaining('/downloads'),
            })
        );
        expect(mockBroadcast).toHaveBeenCalled();
    });

    it('passes User-Agent/Referer/Origin headers through to the request', async () => {
        mockDb();
        const readable = new PassThrough();
        mockRequest.mockResolvedValue({ data: readable });

        await service.start(
            request({
                userAgent: 'IPTVnator',
                referer: 'https://panel.test',
                origin: 'https://panel.test',
            })
        );

        expect(mockRequest).toHaveBeenCalledWith(
            'https://stream.test/live/1',
            expect.objectContaining({
                headers: expect.objectContaining({
                    'User-Agent': 'IPTVnator',
                    Referer: 'https://panel.test',
                    Origin: 'https://panel.test',
                }),
                method: 'GET',
                responseType: 'stream',
            }),
            { allowPrivateNetworks: true }
        );
    });

    it('fails closed without inserting a row when the connection fails', async () => {
        const { insertValues } = mockDb();
        mockRequest.mockRejectedValue(new Error('ECONNREFUSED'));

        const result = await service.start(request());

        expect(result).toEqual({ success: false, error: 'ECONNREFUSED' });
        expect(insertValues).not.toHaveBeenCalled();
    });

    it('fails closed when the target path cannot be reserved', async () => {
        const { insertValues } = mockDb();
        mockOpenSync.mockImplementation(() => {
            throw Object.assign(new Error('EACCES'), { code: 'EACCES' });
        });

        const result = await service.start(request());

        expect(result.success).toBe(false);
        expect(insertValues).not.toHaveBeenCalled();
        expect(mockRequest).not.toHaveBeenCalled();
    });

    it('retries with a numeric suffix when the reserved path already exists', async () => {
        mockDb();
        const readable = new PassThrough();
        mockRequest.mockResolvedValue({ data: readable });
        mockOpenSync
            .mockImplementationOnce(() => {
                throw Object.assign(new Error('EEXIST'), { code: 'EEXIST' });
            })
            .mockReturnValueOnce(3);

        await service.start(request());

        expect(mockCreateWriteStream).toHaveBeenCalledWith(
            expect.stringContaining('-2.ts')
        );
    });

    describe('stop()', () => {
        async function startActive(fileSizeBytes = 4096) {
            const { insertValues, updateSet, updateWhere } = mockDb();
            const readable = new PassThrough();
            mockRequest.mockResolvedValue({ data: readable });
            mockStat.mockResolvedValue({ size: fileSizeBytes });
            const writeStream = fakeWriteStream();
            mockCreateWriteStream.mockReturnValue(writeStream);

            const started = await service.start(request());
            const sessionId = insertValues.mock.calls[0][0].sessionId as string;
            return { sessionId, readable, writeStream, updateSet, updateWhere, started };
        }

        it('finalizes as completed with the real file size on an explicit stop', async () => {
            const { sessionId, updateSet, updateWhere } = await startActive();

            await service.stop(sessionId);

            expect(updateSet).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'completed',
                    fileSizeBytes: 4096,
                })
            );
            expect(updateWhere).toHaveBeenCalled();
        });

        it('is a no-op for an unknown sessionId', async () => {
            mockDb();
            await expect(service.stop('tv:unknown')).resolves.toBeUndefined();
        });

        it('finalizes as interrupted when the stream drops without a stop request', async () => {
            const { readable, updateSet } = await startActive();

            readable.emit('error', new Error('stream dropped'));
            await new Promise((resolve) => setTimeout(resolve, 0));

            expect(updateSet).toHaveBeenCalledWith(
                expect.objectContaining({ status: 'interrupted' }),
            );
        });

        it('finalizes as failed when nothing reached disk', async () => {
            const { sessionId, updateSet } = await startActive(0);

            await service.stop(sessionId);

            expect(updateSet).toHaveBeenCalledWith(
                expect.objectContaining({ status: 'failed' }),
            );
        });

        it('removes the recording from activeRowIds once finalized', async () => {
            const { sessionId } = await startActive();
            expect(service.activeRowIds().size).toBe(1);

            await service.stop(sessionId);

            expect(service.activeRowIds().size).toBe(0);
        });
    });
});
