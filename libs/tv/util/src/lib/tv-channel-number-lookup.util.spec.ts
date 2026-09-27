import type { TvLiveChannel } from './tv-live-catalog.model';
import { resolveChannelByNumber } from './tv-channel-number-lookup.util';

function channel(
    id: string,
    overrides: Partial<TvLiveChannel> = {}
): TvLiveChannel {
    return {
        id,
        name: `Channel ${id}`,
        categoryId: 'all',
        sourceKind: 'xtream',
        playRef: null,
        ...overrides,
    };
}

describe('resolveChannelByNumber', () => {
    it('matches the real channelNumber field, even with gaps in the sequence', () => {
        const channels = [
            channel('a', { channelNumber: 101 }),
            channel('b', { channelNumber: 205 }),
            channel('c', { channelNumber: 999 }),
        ];

        expect(resolveChannelByNumber(channels, '205')).toBe(channels[1]);
    });

    it('returns null for a channelNumber that does not exist', () => {
        const channels = [channel('a', { channelNumber: 101 })];

        expect(resolveChannelByNumber(channels, '999')).toBeNull();
    });

    it('never falls back to list position when real channel numbers exist', () => {
        // Position 1 (1-based) is channel 'a', but nothing carries number 1.
        const channels = [
            channel('a', { channelNumber: 101 }),
            channel('b', { channelNumber: 205 }),
        ];

        expect(resolveChannelByNumber(channels, '1')).toBeNull();
    });

    it('falls back to 1-based list position for M3U channels (no channelNumber field)', () => {
        const channels = [channel('a'), channel('b'), channel('c')];

        expect(resolveChannelByNumber(channels, '2')).toBe(channels[1]);
    });

    it('returns null for an out-of-range position fallback', () => {
        const channels = [channel('a'), channel('b')];

        expect(resolveChannelByNumber(channels, '5')).toBeNull();
    });

    it('returns null for a mixed list with no channel matching the real number', () => {
        // Only some channels carry a real number (e.g. an in-progress adapter
        // refetch) — this still counts as "real numbers exist", so position
        // fallback must not kick in.
        const channels = [
            channel('a', { channelNumber: 101 }),
            channel('b'),
        ];

        expect(resolveChannelByNumber(channels, '2')).toBeNull();
    });

    it('returns null for an empty channel list', () => {
        expect(resolveChannelByNumber([], '1')).toBeNull();
    });

    it('returns null for a non-numeric digit string', () => {
        const channels = [channel('a', { channelNumber: 101 })];

        expect(resolveChannelByNumber(channels, 'abc')).toBeNull();
    });
});
