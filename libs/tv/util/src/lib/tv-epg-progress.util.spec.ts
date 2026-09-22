import { computeCurrentProgramProgress } from './tv-epg-progress.util';

describe('computeCurrentProgramProgress', () => {
    it('returns 0 right at the start', () => {
        expect(computeCurrentProgramProgress(1000, 2000, 1000)).toBe(0);
    });

    it('returns 1 right at the stop', () => {
        expect(computeCurrentProgramProgress(1000, 2000, 2000)).toBe(1);
    });

    it('returns the elapsed fraction mid-programme', () => {
        expect(computeCurrentProgramProgress(1000, 2000, 1250)).toBe(0.25);
    });

    it('clamps below the start instead of going negative', () => {
        expect(computeCurrentProgramProgress(1000, 2000, 500)).toBe(0);
    });

    it('clamps past the stop instead of exceeding 1', () => {
        expect(computeCurrentProgramProgress(1000, 2000, 5000)).toBe(1);
    });

    it('returns undefined for a degenerate (stop <= start) window', () => {
        expect(computeCurrentProgramProgress(2000, 2000, 2000)).toBeUndefined();
        expect(computeCurrentProgramProgress(2000, 1000, 1500)).toBeUndefined();
    });
});
