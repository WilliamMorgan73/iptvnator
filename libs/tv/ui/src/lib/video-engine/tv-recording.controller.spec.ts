import type { RecordingItem } from '@iptvnator/services';
import type { TvRecordingStartRequest } from '@iptvnator/shared/interfaces';
import { TvRecordingController } from './tv-recording.controller';

function recording(overrides: Partial<RecordingItem> = {}): RecordingItem {
    return {
        id: 1,
        status: 'recording',
        filePath: '/downloads/rec.ts',
        channelName: 'Nova Sports 1',
        startedAt: '2026-09-27T12:00:00Z',
        fileAvailability: 'available',
        ...overrides,
    };
}

function request(): TvRecordingStartRequest {
    return {
        metadata: { channelName: 'Nova Sports 1' },
        streamUrl: 'https://stream.test/live/1',
    };
}

describe('TvRecordingController', () => {
    let activeRecording: jest.Mock<RecordingItem | null, []>;
    let start: jest.Mock;
    let stop: jest.Mock;
    let controller: TvRecordingController;

    beforeEach(() => {
        activeRecording = jest.fn().mockReturnValue(null);
        start = jest.fn().mockResolvedValue({ success: true, recordingId: 1 });
        stop = jest.fn().mockResolvedValue({ success: true });
        controller = new TvRecordingController({
            activeRecording,
            start,
            stop,
        });
    });

    it('starts a recording when nothing is active', async () => {
        const buildRequest = jest.fn().mockResolvedValue(request());

        await controller.toggle(buildRequest);

        expect(buildRequest).toHaveBeenCalled();
        expect(start).toHaveBeenCalledWith(request());
        expect(stop).not.toHaveBeenCalled();
    });

    it('stops the active recording instead of starting a new one', async () => {
        activeRecording.mockReturnValue(recording({ id: 7 }));
        const buildRequest = jest.fn();

        await controller.toggle(buildRequest);

        expect(stop).toHaveBeenCalledWith(7);
        expect(buildRequest).not.toHaveBeenCalled();
        expect(start).not.toHaveBeenCalled();
    });

    it('does nothing when nothing is playing to record', async () => {
        const buildRequest = jest.fn().mockResolvedValue(null);

        await controller.toggle(buildRequest);

        expect(start).not.toHaveBeenCalled();
    });

    it('activeRecording() reflects the config', () => {
        activeRecording.mockReturnValue(recording());
        expect(controller.activeRecording()).toEqual(recording());
    });
});
