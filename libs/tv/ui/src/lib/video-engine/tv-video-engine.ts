import Hls from 'hls.js';
import mpegts from 'mpegts.js';
import {
    PlaybackSourceKind,
    resolvePlaybackUrlSourceKind,
} from '@iptvnator/playback/util';

/** Absolute filesystem path (POSIX or Windows) -> a `file://` URL mpegts.js/
 * native `<video>` can fetch. Renderer code has no Node `url` module under
 * context isolation, so this reimplements just enough of `pathToFileURL()`:
 * backslashes to forward slashes, a leading slash guaranteed (Windows drive
 * paths get one prepended), then percent-encoded. */
function toFileUrl(filePath: string): string {
    const normalized = filePath.replace(/\\/g, '/');
    const prefixed = normalized.startsWith('/') ? normalized : `/${normalized}`;
    return `file://${encodeURI(prefixed)}`;
}

/**
 * Minimal, tv-mode-specific video engine: hls.js for HLS manifests,
 * mpegts.js for raw MPEG-TS, native `<video src>` for everything else.
 * Deliberately NOT a wrapper over `HtmlVideoPlayerComponent`/the shared
 * `web-video-support` bridge — those own external-subtitle files, subtitle
 * delay/style customization, DRM (Shaka/DASH), quality menus, and
 * diagnostics panels that v1 tv mode has no UI for, and are built around a
 * `Channel` (M3U-shaped) input rather than the source-agnostic
 * `{streamUrl, headers}` shape every TvLiveSourceAdapter resolves to. This
 * engine only goes as far as toggling an embedded WebVTT-in-HLS subtitle
 * track on/off (`setCaptionsEnabled`) — no track picker, no external files.
 * DASH is out of scope for the same reason as the heavier features above (no
 * Shaka session): a DASH stream falls through to native `<video>` and simply
 * won't play — a known, deliberate v1 gap, not a bug.
 */
export class TvVideoEngine {
    private hls: Hls | null = null;
    private mpegtsPlayer: ReturnType<typeof mpegts.createPlayer> | null =
        null;
    private currentUrl: string | null = null;
    private captionsEnabled = false;

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

    /**
     * Plays a finished tv-mode recording (`TvRecordingService`'s output is
     * always a `.ts` file) — always through mpegts.js with `isLive: false`
     * so the file is seekable/has a real duration, unlike a live channel's
     * `isLive: true`. Falls back to native `<video>` if mpegts.js isn't
     * supported, same as `load()`'s own fallback.
     */
    loadRecording(filePath: string): void {
        this.teardownEngine();
        this.currentUrl = null;
        const url = toFileUrl(filePath);
        if (mpegts.isSupported()) {
            this.loadMpegTs(url, false);
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

    /**
     * Enables/disables the first embedded WebVTT-in-HLS subtitle track, if
     * the manifest has one. No track picker, no external files, no
     * mpegts.js/native-video subtitle support — the smallest slice of
     * desktop's subtitle feature that fits tv mode's minimal engine.
     */
    setCaptionsEnabled(enabled: boolean): void {
        this.captionsEnabled = enabled;
        if (this.hls) {
            this.applyCaptionState(this.hls);
        }
    }

    private applyCaptionState(hls: Hls): void {
        if (this.captionsEnabled && hls.subtitleTracks.length > 0) {
            hls.subtitleTrack = 0;
            hls.subtitleDisplay = true;
        } else {
            hls.subtitleDisplay = false;
            hls.subtitleTrack = -1;
        }
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

    private loadMpegTs(url: string, isLive = true): void {
        this.mpegtsPlayer = mpegts.createPlayer({
            type: 'mpegts',
            isLive,
            url,
        });
        this.mpegtsPlayer.attachMediaElement(this.video);
        this.mpegtsPlayer.load();
    }

    private loadHls(url: string): void {
        const hls = new Hls();
        this.hls = hls;
        hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, () =>
            this.applyCaptionState(hls)
        );
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
