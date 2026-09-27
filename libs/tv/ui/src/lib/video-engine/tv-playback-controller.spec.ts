import type { TvLiveChannel, TvLivePlaybackResult } from '@iptvnator/tv/util';
import { TvPlaybackController } from './tv-playback-controller';
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

function channel(id: string): TvLiveChannel {
    return {
        id,
        name: `Channel ${id}`,
        categoryId: 'all',
        sourceKind: 'xtream',
        playRef: null,
    };
}

const PLAYBACK: TvLivePlaybackResult = { streamUrl: 'https://example.test/x.m3u8' };

describe('TvPlaybackController', () => {
    let resolvePlayback: jest.Mock;
    let applyHeaders: jest.Mock;
    let controller: TvPlaybackController;
    let video: HTMLVideoElement;
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.useFakeTimers();
        resolvePlayback = jest.fn().mockResolvedValue(PLAYBACK);
        applyHeaders = jest.fn().mockReturnValue(null);
        controller = new TvPlaybackController({ resolvePlayback, applyHeaders });
        video = fakeVideo();
        controller.attach(video);
        warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
        controller.destroy();
        jest.useRealTimers();
        warnSpy.mockRestore();
    });

    it('reads the initial volume/paused state on attach', () => {
        expect(controller.videoVolume()).toBe(1);
        expect(controller.videoPaused()).toBe(true);
    });

    describe('captions', () => {
        it('setCaptionsEnabled() is a no-op before attach()', () => {
            const freshController = new TvPlaybackController({
                resolvePlayback,
                applyHeaders,
            });
            expect(() =>
                freshController.setCaptionsEnabled(true)
            ).not.toThrow();
        });

        it('setCaptionsEnabled() forwards to the attached engine', () => {
            const setCaptionsEnabledSpy = jest
                .spyOn(TvVideoEngine.prototype, 'setCaptionsEnabled')
                .mockImplementation(() => undefined);

            controller.setCaptionsEnabled(true);

            expect(setCaptionsEnabledSpy).toHaveBeenCalledWith(true);
            setCaptionsEnabledSpy.mockRestore();
        });
    });

    describe('schedulePreview', () => {
        it('resolves and loads playback after the debounce', async () => {
            controller.schedulePreview(channel('a'));
            expect(resolvePlayback).not.toHaveBeenCalled();

            jest.advanceTimersByTime(400);
            await Promise.resolve();
            await Promise.resolve();

            expect(resolvePlayback).toHaveBeenCalledWith(channel('a'));
            expect(applyHeaders).toHaveBeenCalledWith(PLAYBACK, 'Channel a');
        });

        it('does not restart the debounce for the same channel', () => {
            const ch = channel('a');
            controller.schedulePreview(ch);
            jest.advanceTimersByTime(200);
            controller.schedulePreview(ch); // same channel again, mid-debounce
            jest.advanceTimersByTime(200);

            // Total elapsed 400ms since the FIRST call; if the second call had
            // reset the timer this would still be pending.
            expect(resolvePlayback).toHaveBeenCalledTimes(1);
        });

        it('restarts the debounce when the target channel changes', () => {
            controller.schedulePreview(channel('a'));
            jest.advanceTimersByTime(200);
            controller.schedulePreview(channel('b'));
            jest.advanceTimersByTime(200);

            // Only 200ms elapsed since channel b was requested.
            expect(resolvePlayback).not.toHaveBeenCalled();

            jest.advanceTimersByTime(200);
            expect(resolvePlayback).toHaveBeenCalledTimes(1);
            expect(resolvePlayback).toHaveBeenCalledWith(channel('b'));
        });

        it('ignores an undefined channel', () => {
            controller.schedulePreview(undefined);
            jest.advanceTimersByTime(1000);
            expect(resolvePlayback).not.toHaveBeenCalled();
        });
    });

    describe('playNow', () => {
        it('resolves and loads immediately, with no debounce', async () => {
            await controller.playNow(channel('a'));
            expect(resolvePlayback).toHaveBeenCalledWith(channel('a'));
        });

        it('cancels a pending preview for a different channel', async () => {
            controller.schedulePreview(channel('a'));
            await controller.playNow(channel('b'));
            jest.advanceTimersByTime(1000);
            await Promise.resolve();

            expect(resolvePlayback).toHaveBeenCalledTimes(1);
            expect(resolvePlayback).toHaveBeenCalledWith(channel('b'));
        });

        it('logs and does not throw when resolvePlayback rejects', async () => {
            resolvePlayback.mockRejectedValue(new Error('nothing_to_play'));
            await expect(
                controller.playNow(channel('a'))
            ).resolves.toBeUndefined();
            expect(warnSpy).toHaveBeenCalled();
        });
    });

    describe('playRecording', () => {
        it('loads the file directly, bypassing resolvePlayback/applyHeaders', () => {
            const loadRecordingSpy = jest
                .spyOn(TvVideoEngine.prototype, 'loadRecording')
                .mockImplementation(() => undefined);

            controller.playRecording('/downloads/rec.ts');

            expect(loadRecordingSpy).toHaveBeenCalledWith('/downloads/rec.ts');
            expect(resolvePlayback).not.toHaveBeenCalled();
            expect(applyHeaders).not.toHaveBeenCalled();
            loadRecordingSpy.mockRestore();
        });

        it('cancels a pending channel preview', async () => {
            jest.spyOn(TvVideoEngine.prototype, 'loadRecording').mockImplementation(
                () => undefined
            );
            controller.schedulePreview(channel('a'));

            controller.playRecording('/downloads/rec.ts');
            jest.advanceTimersByTime(1000);
            await Promise.resolve();

            expect(resolvePlayback).not.toHaveBeenCalled();
        });

        it('is a no-op before attach()', () => {
            const freshController = new TvPlaybackController({
                resolvePlayback,
                applyHeaders,
            });
            expect(() =>
                freshController.playRecording('/downloads/rec.ts')
            ).not.toThrow();
        });
    });

    describe('HUD', () => {
        it('adjustVolume shows the volume HUD and updates the signal', () => {
            controller.adjustVolume(-0.3);
            expect(controller.hudKind()).toBe('volume');
            expect(controller.hudVisible()).toBe(true);
            expect(controller.videoVolume()).toBeCloseTo(0.7);
        });

        it('togglePlayPause shows the play-pause HUD', () => {
            controller.togglePlayPause();
            expect(controller.hudKind()).toBe('play-pause');
            expect(controller.hudVisible()).toBe(true);
        });

        it('fades the HUD after its timeout', () => {
            controller.adjustVolume(0.1);
            expect(controller.hudVisible()).toBe(true);
            jest.advanceTimersByTime(1500);
            expect(controller.hudVisible()).toBe(false);
        });

        it('restarts the fade timer on a second HUD trigger', () => {
            controller.adjustVolume(0.1);
            jest.advanceTimersByTime(1000);
            controller.togglePlayPause();
            jest.advanceTimersByTime(1000);
            expect(controller.hudVisible()).toBe(true); // only 1000ms since the second trigger
            jest.advanceTimersByTime(500);
            expect(controller.hudVisible()).toBe(false);
        });
    });

    describe('video element event passthrough', () => {
        it('onVideoPlaying/onVideoPaused update videoPaused', () => {
            controller.onVideoPlaying();
            expect(controller.videoPaused()).toBe(false);
            controller.onVideoPaused();
            expect(controller.videoPaused()).toBe(true);
        });

        it('onVideoVolumeChanged updates videoVolume', () => {
            controller.onVideoVolumeChanged(0.33);
            expect(controller.videoVolume()).toBeCloseTo(0.33);
        });
    });

    describe('destroy', () => {
        it('a pending preview never fires after destroy', async () => {
            controller.schedulePreview(channel('a'));
            controller.destroy();
            jest.advanceTimersByTime(1000);
            await Promise.resolve();
            expect(resolvePlayback).not.toHaveBeenCalled();
        });

        it('adjustVolume/togglePlayPause are no-ops after destroy', () => {
            controller.destroy();
            controller.adjustVolume(0.1);
            controller.togglePlayPause();
            expect(controller.hudVisible()).toBe(false);
        });
    });
});
