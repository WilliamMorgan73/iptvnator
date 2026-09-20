import Hls from 'hls.js';
import mpegts from 'mpegts.js';
import {
    PlaybackSourceKind,
    resolvePlaybackUrlSourceKind,
} from '@iptvnator/playback/util';

/**
 * Minimal, tv-mode-specific video engine: hls.js for HLS manifests,
 * mpegts.js for raw MPEG-TS, native `<video src>` for everything else.
 * Deliberately NOT a wrapper over `HtmlVideoPlayerComponent`/the shared
 * `web-video-support` bridge — those own subtitles, DRM (Shaka/DASH),
 * quality menus, and diagnostics panels that v1 tv mode has no UI for, and
 * are built around a `Channel` (M3U-shaped) input rather than the
 * source-agnostic `{streamUrl, headers}` shape every TvLiveSourceAdapter
 * resolves to. DASH is out of scope for the same reason (no Shaka session):
 * a DASH stream falls through to native `<video>` and simply won't play —
 * a known, deliberate v1 gap, not a bug.
 */
export class TvVideoEngine {
    private hls: Hls | null = null;
    private mpegtsPlayer: ReturnType<typeof mpegts.createPlayer> | null =
        null;
    private currentUrl: string | null = null;

    constructor(private readonly video: HTMLVideoElement) {}

    load(url: string): void {
        if (url === this.currentUrl) {
            return;
        }
        this.teardownEngine();
        this.currentUrl = url;

        const kind = resolvePlaybackUrlSourceKind(url);
        if (kind === PlaybackSourceKind.MpegTs && mpegts.isSupported()) {
            this.loadMpegTs(url);
        } else if (
            kind !== PlaybackSourceKind.Native &&
            kind !== PlaybackSourceKind.Dash &&
            Hls.isSupported()
        ) {
            this.loadHls(url);
        } else {
            this.loadNative(url);
        }
        this.safePlay();
    }

    destroy(): void {
        this.currentUrl = null;
        this.teardownEngine();
    }

    togglePlayPause(): void {
        if (this.video.paused) {
            this.safePlay();
        } else {
            this.video.pause();
        }
    }

    get paused(): boolean {
        return this.video.paused;
    }

    get volume(): number {
        return this.video.volume;
    }

    setVolume(value: number): void {
        this.video.volume = Math.min(1, Math.max(0, value));
    }

    private teardownEngine(): void {
        const mpegtsPlayer = this.mpegtsPlayer;
        this.mpegtsPlayer = null;
        if (mpegtsPlayer) {
            mpegtsPlayer.pause();
            mpegtsPlayer.unload();
            mpegtsPlayer.detachMediaElement();
            mpegtsPlayer.destroy();
        }

        const hls = this.hls;
        this.hls = null;
        hls?.destroy();

        this.video.removeAttribute('src');
        this.video.load();
    }

    private loadMpegTs(url: string): void {
        this.mpegtsPlayer = mpegts.createPlayer({
            type: 'mpegts',
            isLive: true,
            url,
        });
        this.mpegtsPlayer.attachMediaElement(this.video);
        this.mpegtsPlayer.load();
    }

    private loadHls(url: string): void {
        const hls = new Hls();
        this.hls = hls;
        hls.attachMedia(this.video);
        hls.loadSource(url);
    }

    private loadNative(url: string): void {
        this.video.src = url;
        this.video.load();
    }

    /**
     * `HTMLMediaElement.play()` returns a Promise per spec, but not every
     * environment honors that (jsdom's stub returns `undefined`) — calling
     * `.catch()` unconditionally would throw there instead of just failing
     * to autoplay.
     */
    private safePlay(): void {
        const result = this.video.play();
        if (result && typeof result.catch === 'function') {
            result.catch(() => undefined);
        }
    }
}
