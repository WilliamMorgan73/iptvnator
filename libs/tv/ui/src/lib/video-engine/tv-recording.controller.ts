import type { RecordingItem } from '@iptvnator/services';
import type {
    ElectronBridgeErrorResult,
    TvRecordingStartRequest,
    TvRecordingStartResult,
} from '@iptvnator/shared/interfaces';

export interface TvRecordingControllerConfig {
    activeRecording(): RecordingItem | null;
    start(request: TvRecordingStartRequest): Promise<TvRecordingStartResult>;
    stop(recordingId: number): Promise<ElectronBridgeErrorResult>;
}

/**
 * Toggles tv-mode's independent recorder (no Embedded MPV) on/off for
 * whatever is currently playing. DI-free, same shape as
 * `TvPlaybackController`/`TvDigitEntryController` — the shell wires it to
 * the real `RecordingsService`. Only one recording is ever active at a time
 * (matches desktop's own single-recording reality), so toggling never needs
 * to know which channel a running recording belongs to.
 */
export class TvRecordingController {
    constructor(private readonly config: TvRecordingControllerConfig) {}

    activeRecording(): RecordingItem | null {
        return this.config.activeRecording();
    }

    /**
     * `buildRequest` is async (and may return `null`) because starting a new
     * recording needs a freshly resolved stream URL — Stalker's temporary
     * playback links live only a few seconds, so a previously resolved one
     * cannot be reused — and there may be nothing playing to record at all.
     */
    async toggle(
        buildRequest: () => Promise<TvRecordingStartRequest | null>
    ): Promise<void> {
        const active = this.activeRecording();
        if (active) {
            await this.config.stop(active.id);
            return;
        }
        const request = await buildRequest();
        if (!request) {
            return;
        }
        await this.config.start(request);
    }
}
