import { signal } from '@angular/core';
import type { TvLiveChannel, TvLivePlaybackResult } from '@iptvnator/tv/util';
import type { TvPlaybackHudKind } from '../playback-hud/tv-playback-hud.component';
import { TvVideoEngine } from './tv-video-engine';

const PREVIEW_DEBOUNCE_MS = 400;
const HUD_TIMEOUT_MS = 1500;
export const VOLUME_STEP = 0.1;

export interface TvPlaybackControllerConfig {
    resolvePlayback: (channel: TvLiveChannel) => Promise<TvLivePlaybackResult>;
    /** Mirrors ElectronStreamHeadersService.apply(); null in the PWA/no-bridge case. */
    applyHeaders: (
        playback: TvLivePlaybackResult,
        title: string
    ) => Promise<boolean> | null;
}

/**
 * Owns the video engine, the transient HUD's visibility/fade timing, and the
 * debounced "swap the preview as focus moves" behavior — the tv-mode plan's
 * "Moving through the channel list is meant to swap the live video preview
 * in real time" note, with "a debounce ... so scrolling fast doesn't hammer
 * the network." A plain, DI-free class (like GridFocusController) so it's
 * independently testable with fake resolvePlayback/applyHeaders callbacks;
 * the shell supplies the real ones bound to TvLiveCatalogFacade/
 * ElectronStreamHeadersService.
 */
export class TvPlaybackController {
    readonly hudVisible = signal(false);
    readonly hudKind = signal<TvPlaybackHudKind>('volume');
    readonly videoPaused = signal(true);
    readonly videoVolume = signal(1);

    private engine: TvVideoEngine | null = null;
    private hudTimeoutId: ReturnType<typeof setTimeout> | null = null;
    private previewDebounceId: ReturnType<typeof setTimeout> | null = null;
    private pendingChannelId: string | null = null;

    constructor(private readonly config: TvPlaybackControllerConfig) {}

    attach(video: HTMLVideoElement): void {
        this.engine = new TvVideoEngine(video);
        this.videoVolume.set(this.engine.volume);
        this.videoPaused.set(this.engine.paused);
    }

    destroy(): void {
        this.engine?.destroy();
        this.engine = null;
        this.clearHudTimer();
        this.clearPreviewTimer();
    }

    /** Called on every focus-index-changing key/gamepad input; debounced. */
    schedulePreview(channel: TvLiveChannel | undefined): void {
        if (!channel || channel.id === this.pendingChannelId) {
            return;
        }
        this.pendingChannelId = channel.id;
        this.clearPreviewTimer();
        this.previewDebounceId = setTimeout(() => {
            this.previewDebounceId = null;
            void this.loadChannel(channel);
        }, PREVIEW_DEBOUNCE_MS);
    }

    /** Called on activate() (Enter/A): confirm and play immediately, no debounce. */
    async playNow(channel: TvLiveChannel): Promise<void> {
        this.pendingChannelId = channel.id;
        this.clearPreviewTimer();
        await this.loadChannel(channel);
    }

    adjustVolume(delta: number): void {
        if (!this.engine) {
            return;
        }
        this.engine.setVolume(this.engine.volume + delta);
        this.videoVolume.set(this.engine.volume);
        this.showHud('volume');
    }

    togglePlayPause(): void {
        if (!this.engine) {
            return;
        }
        this.engine.togglePlayPause();
        this.showHud('play-pause');
    }

    /** Wired to the <video> element's own play/pause/volumechange events. */
    onVideoPlaying(): void {
        this.videoPaused.set(false);
    }

    onVideoPaused(): void {
        this.videoPaused.set(true);
    }

    onVideoVolumeChanged(volume: number): void {
        this.videoVolume.set(volume);
    }

    private async loadChannel(channel: TvLiveChannel): Promise<void> {
        if (!this.engine) {
            return;
        }
        try {
            const playback = await this.config.resolvePlayback(channel);
            const headersApplied = this.config.applyHeaders(
                playback,
                channel.name
            );
            if (headersApplied) {
                await headersApplied;
            }
            this.engine.load(playback.streamUrl);
        } catch (error) {
            console.warn('[tv] Failed to resolve playback for', channel.name, error);
        }
    }

    private showHud(kind: TvPlaybackHudKind): void {
        this.hudKind.set(kind);
        this.hudVisible.set(true);
        this.clearHudTimer();
        this.hudTimeoutId = setTimeout(
            () => this.hudVisible.set(false),
            HUD_TIMEOUT_MS
        );
    }

    private clearHudTimer(): void {
        if (this.hudTimeoutId !== null) {
            clearTimeout(this.hudTimeoutId);
            this.hudTimeoutId = null;
        }
    }

    private clearPreviewTimer(): void {
        if (this.previewDebounceId !== null) {
            clearTimeout(this.previewDebounceId);
            this.previewDebounceId = null;
        }
    }
}
