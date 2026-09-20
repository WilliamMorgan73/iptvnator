import Hls from 'hls.js';
import mpegts from 'mpegts.js';
import { TvVideoEngine } from './tv-video-engine';

function fakeVideo(): HTMLVideoElement {
    return {
        paused: true,
        volume: 1,
        src: '',
        play: jest.fn().mockResolvedValue(undefined),
        pause: jest.fn(),
        load: jest.fn(),
        removeAttribute: jest.fn(),
    } as unknown as HTMLVideoElement;
}

describe('TvVideoEngine', () => {
    let hlsAttachMedia: jest.SpyInstance;
    let hlsLoadSource: jest.SpyInstance;
    let hlsDestroy: jest.SpyInstance;
    let mpegtsPlayer: {
        attachMediaElement: jest.Mock;
        load: jest.Mock;
        pause: jest.Mock;
        unload: jest.Mock;
        detachMediaElement: jest.Mock;
        destroy: jest.Mock;
    };

    beforeEach(() => {
        jest.spyOn(Hls, 'isSupported').mockReturnValue(true);
        jest.spyOn(mpegts, 'isSupported').mockReturnValue(false);
        hlsAttachMedia = jest
            .spyOn(Hls.prototype, 'attachMedia')
            .mockImplementation(() => undefined);
        hlsLoadSource = jest
            .spyOn(Hls.prototype, 'loadSource')
            .mockImplementation(() => undefined);
        hlsDestroy = jest
            .spyOn(Hls.prototype, 'destroy')
            .mockImplementation(() => undefined);

        mpegtsPlayer = {
            attachMediaElement: jest.fn(),
            load: jest.fn(),
            pause: jest.fn(),
            unload: jest.fn(),
            detachMediaElement: jest.fn(),
            destroy: jest.fn(),
        };
        jest.spyOn(mpegts, 'createPlayer').mockReturnValue(
            mpegtsPlayer as unknown as ReturnType<typeof mpegts.createPlayer>
        );
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('loads an HLS manifest through hls.js', () => {
        const video = fakeVideo();
        const engine = new TvVideoEngine(video);

        engine.load('https://example.test/live.m3u8');

        expect(hlsAttachMedia).toHaveBeenCalledWith(video);
        expect(hlsLoadSource).toHaveBeenCalledWith(
            'https://example.test/live.m3u8'
        );
        expect(video.play).toHaveBeenCalledTimes(1);
    });

    it('loads raw MPEG-TS through mpegts.js when supported', () => {
        (mpegts.isSupported as jest.Mock).mockReturnValue(true);
        const video = fakeVideo();
        const engine = new TvVideoEngine(video);

        engine.load('https://example.test/live.ts');

        expect(mpegts.createPlayer).toHaveBeenCalledWith({
            type: 'mpegts',
            isLive: true,
            url: 'https://example.test/live.ts',
        });
        expect(mpegtsPlayer.attachMediaElement).toHaveBeenCalledWith(video);
        expect(mpegtsPlayer.load).toHaveBeenCalledTimes(1);
    });

    it('falls back to hls.js for raw MPEG-TS when mpegts.js is unsupported', () => {
        const video = fakeVideo();
        const engine = new TvVideoEngine(video);

        engine.load('https://example.test/live.ts');

        expect(mpegts.createPlayer).not.toHaveBeenCalled();
        expect(hlsLoadSource).toHaveBeenCalledWith(
            'https://example.test/live.ts'
        );
    });

    it('falls back to a native <video src> for an unrecognized container', () => {
        const video = fakeVideo();
        const engine = new TvVideoEngine(video);

        engine.load('https://example.test/movie.mkv');

        expect(hlsAttachMedia).not.toHaveBeenCalled();
        expect(mpegts.createPlayer).not.toHaveBeenCalled();
        expect(video.src).toBe('https://example.test/movie.mkv');
        // Called twice: once by the unconditional teardown every load()
        // starts with (a no-op reset on a fresh engine), once by the native
        // branch itself.
        expect(video.load).toHaveBeenCalledTimes(2);
    });

    it('falls back to native for a DASH manifest (no Shaka session in v1)', () => {
        const video = fakeVideo();
        const engine = new TvVideoEngine(video);

        engine.load('https://example.test/live.mpd');

        expect(hlsAttachMedia).not.toHaveBeenCalled();
        expect(video.src).toBe('https://example.test/live.mpd');
    });

    it('does not reload the same url twice in a row', () => {
        const video = fakeVideo();
        const engine = new TvVideoEngine(video);

        engine.load('https://example.test/live.m3u8');
        engine.load('https://example.test/live.m3u8');

        expect(hlsLoadSource).toHaveBeenCalledTimes(1);
    });

    it('tears down the previous hls.js instance before loading a new url', () => {
        const video = fakeVideo();
        const engine = new TvVideoEngine(video);

        engine.load('https://example.test/a.m3u8');
        engine.load('https://example.test/b.m3u8');

        expect(hlsDestroy).toHaveBeenCalledTimes(1);
        expect(hlsLoadSource).toHaveBeenNthCalledWith(
            1,
            'https://example.test/a.m3u8'
        );
        expect(hlsLoadSource).toHaveBeenNthCalledWith(
            2,
            'https://example.test/b.m3u8'
        );
    });

    it('tears everything down on destroy()', () => {
        const video = fakeVideo();
        const engine = new TvVideoEngine(video);
        engine.load('https://example.test/live.m3u8');

        engine.destroy();

        expect(hlsDestroy).toHaveBeenCalledTimes(1);
        expect(video.removeAttribute).toHaveBeenCalledWith('src');
        expect(video.load).toHaveBeenCalled();
    });

    describe('play/pause/volume passthrough', () => {
        it('togglePlayPause() plays a paused video', () => {
            const video = fakeVideo();
            (video as { paused: boolean }).paused = true;
            const engine = new TvVideoEngine(video);

            engine.togglePlayPause();

            expect(video.play).toHaveBeenCalledTimes(1);
            expect(video.pause).not.toHaveBeenCalled();
        });

        it('togglePlayPause() pauses a playing video', () => {
            const video = fakeVideo();
            (video as { paused: boolean }).paused = false;
            const engine = new TvVideoEngine(video);

            engine.togglePlayPause();

            expect(video.pause).toHaveBeenCalledTimes(1);
        });

        it('setVolume() clamps to [0, 1]', () => {
            const video = fakeVideo();
            const engine = new TvVideoEngine(video);

            engine.setVolume(1.5);
            expect(video.volume).toBe(1);

            engine.setVolume(-0.5);
            expect(video.volume).toBe(0);

            engine.setVolume(0.42);
            expect(video.volume).toBeCloseTo(0.42);
        });
    });
});
