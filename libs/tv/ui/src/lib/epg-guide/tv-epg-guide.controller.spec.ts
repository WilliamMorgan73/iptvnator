import { getTodayEpgDateKey, shiftEpgDateKey } from '@iptvnator/ui/epg';
import type { TvEpgGuideAdapter, TvEpgGuideChannel } from '@iptvnator/tv/util';
import { TvEpgGuideController } from './tv-epg-guide.controller';

function channel(id: string, number: number): TvEpgGuideChannel {
    return { id, number, name: `Channel ${id}`, logoUrl: null };
}

describe('TvEpgGuideController', () => {
    let channels: TvEpgGuideChannel[];
    let loadPrograms: jest.Mock;
    let adapter: TvEpgGuideAdapter | null;
    let controller: TvEpgGuideController;

    beforeEach(() => {
        channels = [channel('a', 1), channel('b', 2)];
        loadPrograms = jest.fn().mockResolvedValue(new Map());
        adapter = { channels: () => channels, loadPrograms };
        controller = new TvEpgGuideController({ adapter: () => adapter });
    });

    describe('open', () => {
        it('loads channels and focuses the first row when no channel is active', async () => {
            controller.open(null);
            await Promise.resolve();

            expect(controller.channels()).toEqual(channels);
            expect(controller.focus.focus()).toEqual({ row: 0, block: null });
        });

        it('focuses the active channel row when it is in the guide list', async () => {
            controller.open('b');
            await Promise.resolve();

            expect(controller.focus.focus()).toEqual({ row: 1, block: null });
        });

        it('falls back to the first row when the active channel is not in the guide list', async () => {
            controller.open('unknown');
            await Promise.resolve();

            expect(controller.focus.focus()).toEqual({ row: 0, block: null });
        });

        it('focuses nothing for an empty channel list', async () => {
            channels = [];
            controller.open(null);
            await Promise.resolve();

            expect(controller.focus.focus()).toBeNull();
        });

        it('resets to today', () => {
            controller.stepDay('next');
            controller.open(null);

            expect(controller.dateKey()).toBe(getTodayEpgDateKey());
        });

        it('requests the current day window from the adapter', async () => {
            controller.open(null);
            await Promise.resolve();

            expect(loadPrograms).toHaveBeenCalledWith(
                expect.objectContaining({ channelIds: ['a', 'b'] })
            );
            const call = loadPrograms.mock.calls[0][0];
            expect(call.toMs - call.fromMs).toBe(24 * 60 * 60 * 1000);
        });

        it('populates programsByChannelId from the adapter response', async () => {
            const programs = new Map([['a', [{ title: 'Show' }]]]);
            loadPrograms.mockResolvedValue(programs);

            controller.open(null);
            await Promise.resolve();
            await Promise.resolve();

            expect(controller.programsByChannelId()).toEqual(programs);
        });
    });

    describe('close', () => {
        it('resets focus', async () => {
            controller.open(null);
            await Promise.resolve();

            controller.close();

            expect(controller.focus.focus()).toBeNull();
        });
    });

    describe('stepDay', () => {
        it('shifts the date key and re-fetches', async () => {
            controller.open(null);
            await Promise.resolve();
            loadPrograms.mockClear();
            const today = getTodayEpgDateKey();

            controller.stepDay('next');
            await Promise.resolve();

            expect(controller.dateKey()).toBe(shiftEpgDateKey(today, 'next'));
            expect(loadPrograms).toHaveBeenCalledTimes(1);
        });

        it('steps backward for "previous"', () => {
            const today = getTodayEpgDateKey();
            controller.stepDay('previous');

            expect(controller.dateKey()).toBe(shiftEpgDateKey(today, 'prev'));
        });
    });

    describe('focusedChannel', () => {
        it('returns the channel at the focused row', async () => {
            controller.open('b');
            await Promise.resolve();

            expect(controller.focusedChannel()).toEqual(channel('b', 2));
        });

        it('returns null when nothing is focused', () => {
            expect(controller.focusedChannel()).toBeNull();
        });
    });

    describe('stale response handling', () => {
        it('a slower earlier request never clobbers a faster later one', async () => {
            const first = new Map([['a', [{ title: 'Stale' }]]]);
            const second = new Map([['a', [{ title: 'Fresh' }]]]);
            let resolveFirst!: (value: typeof first) => void;
            loadPrograms
                .mockImplementationOnce(
                    () =>
                        new Promise((resolve) => {
                            resolveFirst = resolve;
                        })
                )
                .mockResolvedValueOnce(second);

            controller.open(null); // kicks off the first (slow) request
            controller.stepDay('next'); // kicks off the second (fast) request
            await Promise.resolve();
            await Promise.resolve();
            resolveFirst(first); // the slow one settles last
            await Promise.resolve();
            await Promise.resolve();

            expect(controller.programsByChannelId()).toEqual(second);
        });
    });

    describe('with no adapter', () => {
        it('clears channels and programmes without throwing', async () => {
            adapter = null;
            controller.open(null);
            await Promise.resolve();

            expect(controller.channels()).toEqual([]);
            expect(controller.programsByChannelId().size).toBe(0);
        });
    });
});
