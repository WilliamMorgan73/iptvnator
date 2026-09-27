import {
    computeEpgGuideBlockLayout,
    computeEpgGuideNowPercent,
} from './tv-epg-guide-timeline.util';

const DAY_START = Date.parse('2026-09-27T00:00:00.000Z');
const DAY_END = DAY_START + 24 * 60 * 60 * 1000;

describe('computeEpgGuideBlockLayout', () => {
    it('positions a programme fully inside the window', () => {
        const layout = computeEpgGuideBlockLayout(
            {
                start: '2026-09-27T06:00:00.000Z',
                stop: '2026-09-27T08:00:00.000Z',
            },
            DAY_START,
            DAY_END
        );

        expect(layout?.leftPercent).toBe(25);
        expect(layout?.widthPercent).toBeCloseTo(100 / 12, 5);
    });

    it('clips a programme that started before the window', () => {
        const layout = computeEpgGuideBlockLayout(
            {
                start: '2026-09-26T23:00:00.000Z',
                stop: '2026-09-27T01:00:00.000Z',
            },
            DAY_START,
            DAY_END
        );

        expect(layout?.leftPercent).toBe(0);
        expect(layout?.widthPercent).toBeCloseTo(100 / 24, 5);
    });

    it('clips a programme that ends after the window', () => {
        const layout = computeEpgGuideBlockLayout(
            {
                start: '2026-09-27T23:00:00.000Z',
                stop: '2026-09-28T01:00:00.000Z',
            },
            DAY_START,
            DAY_END
        );

        expect(layout?.leftPercent).toBeCloseTo((23 / 24) * 100, 5);
        expect(layout?.widthPercent).toBeCloseTo(100 / 24, 5);
    });

    it('floors a very short programme to the minimum readable width', () => {
        const layout = computeEpgGuideBlockLayout(
            {
                start: '2026-09-27T06:00:00.000Z',
                stop: '2026-09-27T06:01:00.000Z',
            },
            DAY_START,
            DAY_END
        );

        expect(layout?.widthPercent).toBe(2);
    });

    it('returns null for a programme entirely outside the window', () => {
        const layout = computeEpgGuideBlockLayout(
            {
                start: '2026-09-28T06:00:00.000Z',
                stop: '2026-09-28T08:00:00.000Z',
            },
            DAY_START,
            DAY_END
        );

        expect(layout).toBeNull();
    });

    it('returns null for a malformed start/stop pair', () => {
        expect(
            computeEpgGuideBlockLayout(
                { start: 'not-a-date', stop: '2026-09-27T08:00:00.000Z' },
                DAY_START,
                DAY_END
            )
        ).toBeNull();
        expect(
            computeEpgGuideBlockLayout(
                {
                    start: '2026-09-27T08:00:00.000Z',
                    stop: '2026-09-27T06:00:00.000Z',
                },
                DAY_START,
                DAY_END
            )
        ).toBeNull();
    });
});

describe('computeEpgGuideNowPercent', () => {
    it('positions now within the window', () => {
        const nowMs = DAY_START + 6 * 60 * 60 * 1000; // 06:00
        expect(computeEpgGuideNowPercent(nowMs, DAY_START, DAY_END)).toBe(25);
    });

    it('returns null when now is before the window', () => {
        expect(
            computeEpgGuideNowPercent(DAY_START - 1000, DAY_START, DAY_END)
        ).toBeNull();
    });

    it('returns null when now is after the window', () => {
        expect(
            computeEpgGuideNowPercent(DAY_END + 1000, DAY_START, DAY_END)
        ).toBeNull();
    });
});
