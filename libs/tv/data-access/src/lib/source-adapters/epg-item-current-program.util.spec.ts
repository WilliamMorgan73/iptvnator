import type { EpgItem, EpgProgram } from '@iptvnator/shared/interfaces';
import {
    currentProgramFieldsOf,
    currentProgramFieldsOfProgram,
    findCurrentEpgProgram,
} from './epg-item-current-program.util';

const NOW_MS = Date.parse('2026-01-01T12:00:00.000Z');

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
        start_timestamp: String(Date.parse('2026-01-01T11:30:00.000Z') / 1000),
        stop_timestamp: String(Date.parse('2026-01-01T12:30:00.000Z') / 1000),
        ...overrides,
    };
}

function epgProgram(overrides: Partial<EpgProgram> = {}): EpgProgram {
    return {
        start: '2026-01-01T11:30:00.000Z',
        stop: '2026-01-01T12:30:00.000Z',
        channel: '101',
        title: 'Now Playing',
        desc: 'A description.',
        category: null,
        startTimestamp: Date.parse('2026-01-01T11:30:00.000Z') / 1000,
        stopTimestamp: Date.parse('2026-01-01T12:30:00.000Z') / 1000,
        ...overrides,
    };
}

describe('currentProgramFieldsOf (EpgItem)', () => {
    it('returns no fields for null', () => {
        expect(currentProgramFieldsOf(null, NOW_MS)).toEqual({});
    });

    it('maps title/description/time-range/progress for a current item', () => {
        const fields = currentProgramFieldsOf(epgItem(), NOW_MS);
        expect(fields.currentProgramTitle).toBe('Now Playing');
        expect(fields.currentProgramDescription).toBe('A description.');
        expect(fields.currentProgramStart).toBe('2026-01-01T11:30:00.000Z');
        expect(fields.currentProgramStop).toBe('2026-01-01T12:30:00.000Z');
        expect(fields.currentProgramProgress).toBe(0.5);
    });

    it('falls back to end when stop is absent, and omits an empty description', () => {
        const fields = currentProgramFieldsOf(
            epgItem({
                stop: undefined as unknown as string,
                end: '2026-01-01T12:30:00.000Z',
                description: '',
            }),
            NOW_MS
        );
        expect(fields.currentProgramStop).toBe('2026-01-01T12:30:00.000Z');
        expect(fields.currentProgramDescription).toBeUndefined();
    });
});

describe('findCurrentEpgProgram', () => {
    it('picks the program whose window contains now', () => {
        const earlier = epgProgram({
            title: 'Earlier',
            start: '2026-01-01T10:00:00.000Z',
            stop: '2026-01-01T11:30:00.000Z',
            startTimestamp: Date.parse('2026-01-01T10:00:00.000Z') / 1000,
            stopTimestamp: Date.parse('2026-01-01T11:30:00.000Z') / 1000,
        });
        const current = epgProgram();
        expect(findCurrentEpgProgram([earlier, current], NOW_MS)).toBe(
            current
        );
    });

    it('returns null when nothing matches', () => {
        const future = epgProgram({
            start: '2026-01-01T13:00:00.000Z',
            stop: '2026-01-01T14:00:00.000Z',
            startTimestamp: Date.parse('2026-01-01T13:00:00.000Z') / 1000,
            stopTimestamp: Date.parse('2026-01-01T14:00:00.000Z') / 1000,
        });
        expect(findCurrentEpgProgram([future], NOW_MS)).toBeNull();
    });
});

describe('currentProgramFieldsOfProgram (EpgProgram)', () => {
    it('returns no fields for null', () => {
        expect(currentProgramFieldsOfProgram(null, NOW_MS)).toEqual({});
    });

    it('maps title/description/time-range/progress for a current program', () => {
        const fields = currentProgramFieldsOfProgram(epgProgram(), NOW_MS);
        expect(fields.currentProgramTitle).toBe('Now Playing');
        expect(fields.currentProgramDescription).toBe('A description.');
        expect(fields.currentProgramProgress).toBe(0.5);
    });
});
