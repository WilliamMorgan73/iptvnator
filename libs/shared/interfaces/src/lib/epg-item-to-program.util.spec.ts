import { epgItemToProgram } from './epg-item-to-program.util';
import type { EpgItem } from './epg-item.interface';

function epgItem(overrides: Partial<EpgItem> = {}): EpgItem {
    return {
        id: '1',
        epg_id: '1',
        title: 'Now Playing',
        lang: 'en',
        start: '2026-01-01T11:30:00.000Z',
        end: '2026-01-01T12:30:00.000Z',
        stop: '2026-01-01T12:30:00.000Z',
        description: 'A description.',
        channel_id: '101',
        start_timestamp: '1767267000',
        stop_timestamp: '1767270600',
        ...overrides,
    };
}

describe('epgItemToProgram', () => {
    it('maps every field onto the EpgProgram shape', () => {
        expect(epgItemToProgram(epgItem(), 'ch-101')).toEqual({
            start: '2026-01-01T11:30:00.000Z',
            stop: '2026-01-01T12:30:00.000Z',
            channel: 'ch-101',
            title: 'Now Playing',
            desc: 'A description.',
            category: null,
            startTimestamp: 1767267000,
            stopTimestamp: 1767270600,
        });
    });

    it('falls back to end when stop is empty', () => {
        const program = epgItemToProgram(
            epgItem({ stop: '' }),
            'fallback'
        );
        expect(program.stop).toBe('2026-01-01T12:30:00.000Z');
    });

    it('always uses the caller-supplied channel id, not item.channel_id', () => {
        const program = epgItemToProgram(
            epgItem({ channel_id: 'other-channel' }),
            'ch-42'
        );
        expect(program.channel).toBe('ch-42');
    });

    it('nulls an empty description and unparseable timestamps', () => {
        const program = epgItemToProgram(
            epgItem({
                description: '',
                start_timestamp: 'not-a-number',
                stop_timestamp: '',
            }),
            'fallback'
        );
        expect(program.desc).toBeNull();
        expect(program.startTimestamp).toBeNull();
        expect(program.stopTimestamp).toBeNull();
    });
});
