import type { TvLiveChannel } from '@iptvnator/tv/util';
import { TvDigitEntryController } from './tv-digit-entry.controller';

function channel(id: string, channelNumber?: number): TvLiveChannel {
    return {
        id,
        name: `Channel ${id}`,
        categoryId: 'sports',
        sourceKind: 'xtream',
        playRef: null,
        channelNumber,
    };
}

describe('TvDigitEntryController', () => {
    let channels: TvLiveChannel[];
    let onChannelResolved: jest.Mock;
    let controller: TvDigitEntryController;

    beforeEach(() => {
        jest.useFakeTimers();
        channels = [channel('a', 101), channel('b', 205)];
        onChannelResolved = jest.fn();
        controller = new TvDigitEntryController({
            channels: () => channels,
            onChannelResolved,
        });
    });

    afterEach(() => {
        controller.destroy();
        jest.useRealTimers();
    });

    it('accumulates typed digits into the digits signal', () => {
        controller.onDigit(2);
        controller.onDigit(0);
        controller.onDigit(5);

        expect(controller.digits()).toBe('205');
    });

    it('commits and resolves the matching channel after the inactivity timeout', () => {
        controller.onDigit(2);
        controller.onDigit(0);
        controller.onDigit(5);

        jest.advanceTimersByTime(1750);

        expect(onChannelResolved).toHaveBeenCalledWith(channels[1]);
        expect(controller.digits()).toBe('');
    });

    it('does not commit before the inactivity timeout elapses', () => {
        controller.onDigit(2);
        jest.advanceTimersByTime(1000);

        expect(onChannelResolved).not.toHaveBeenCalled();
    });

    it('restarts the timeout on every new digit', () => {
        controller.onDigit(2);
        jest.advanceTimersByTime(1000);
        controller.onDigit(0);
        jest.advanceTimersByTime(1000);
        controller.onDigit(5);
        jest.advanceTimersByTime(1000);

        // Only 1000ms elapsed since the last digit each time — never commits.
        expect(onChannelResolved).not.toHaveBeenCalled();

        jest.advanceTimersByTime(750);
        expect(onChannelResolved).toHaveBeenCalledWith(channels[1]);
    });

    it('clears the buffer and calls nothing when no channel matches', () => {
        controller.onDigit(9);
        controller.onDigit(9);
        controller.onDigit(9);

        jest.advanceTimersByTime(1750);

        expect(onChannelResolved).not.toHaveBeenCalled();
        expect(controller.digits()).toBe('');
    });

    it('starts a fresh entry after a commit', () => {
        controller.onDigit(1);
        controller.onDigit(0);
        controller.onDigit(1);
        jest.advanceTimersByTime(1750);
        onChannelResolved.mockClear();

        controller.onDigit(2);
        controller.onDigit(0);
        controller.onDigit(5);
        jest.advanceTimersByTime(1750);

        expect(onChannelResolved).toHaveBeenCalledWith(channels[1]);
    });

    it('a pending commit never fires after destroy()', () => {
        controller.onDigit(1);
        controller.onDigit(0);
        controller.onDigit(1);

        controller.destroy();
        jest.advanceTimersByTime(5000);

        expect(onChannelResolved).not.toHaveBeenCalled();
    });
});
