import { TvEpgGuideFocusController } from './tv-epg-guide-focus.controller';

function controller(
    rowCount: number,
    blockCounts: readonly number[]
): TvEpgGuideFocusController {
    return new TvEpgGuideFocusController({
        rowCount: () => rowCount,
        blockCount: (row) => blockCounts[row] ?? 0,
    });
}

describe('TvEpgGuideFocusController', () => {
    describe('moveRow', () => {
        it('starts at row 0 from an unfocused state, moving down', () => {
            const focus = controller(3, [0, 0, 0]);
            focus.moveRow(1);
            expect(focus.focus()).toEqual({ row: 0, block: null });
        });

        it('starts at the last row from an unfocused state, moving up', () => {
            const focus = controller(3, [0, 0, 0]);
            focus.moveRow(-1);
            expect(focus.focus()).toEqual({ row: 2, block: null });
        });

        it('moves between rows and resets block focus', () => {
            const focus = controller(3, [2, 2, 2]);
            focus.moveRow(1);
            focus.moveBlock(1);
            expect(focus.focus()).toEqual({ row: 0, block: 0 });

            focus.moveRow(1);
            expect(focus.focus()).toEqual({ row: 1, block: null });
        });

        it('is a no-op at the top/bottom boundary', () => {
            const focus = controller(2, [0, 0]);
            focus.moveRow(1);
            focus.moveRow(-1);
            expect(focus.focus()).toEqual({ row: 0, block: null });

            focus.moveRow(1);
            focus.moveRow(1);
            expect(focus.focus()).toEqual({ row: 1, block: null });
        });

        it('is a no-op when there are no rows', () => {
            const focus = controller(0, []);
            focus.moveRow(1);
            expect(focus.focus()).toBeNull();
        });
    });

    describe('moveBlock', () => {
        it('is a no-op before any row is focused', () => {
            const focus = controller(2, [3, 3]);
            focus.moveBlock(1);
            expect(focus.focus()).toBeNull();
        });

        it('is a no-op for a row with no blocks', () => {
            const focus = controller(2, [0, 3]);
            focus.moveRow(1);
            focus.moveBlock(1);
            expect(focus.focus()).toEqual({ row: 0, block: null });
        });

        it('moves across blocks within the focused row, clamped at the edges', () => {
            const focus = controller(1, [3]);
            focus.moveRow(1);

            focus.moveBlock(1);
            expect(focus.focus()).toEqual({ row: 0, block: 0 });
            focus.moveBlock(1);
            expect(focus.focus()).toEqual({ row: 0, block: 1 });
            focus.moveBlock(1);
            expect(focus.focus()).toEqual({ row: 0, block: 2 });
            focus.moveBlock(1); // no-op at the last block
            expect(focus.focus()).toEqual({ row: 0, block: 2 });
        });

        it('enters from the right edge when moving left first', () => {
            const focus = controller(1, [3]);
            focus.moveRow(1);

            focus.moveBlock(-1);
            expect(focus.focus()).toEqual({ row: 0, block: 2 });
        });
    });

    describe('activate', () => {
        it('invokes the callback with the focused row', () => {
            const focus = controller(2, [1, 1]);
            focus.moveRow(1);
            focus.moveRow(1);
            const onActivate = jest.fn();

            focus.activate(onActivate);

            expect(onActivate).toHaveBeenCalledWith(1);
        });

        it('is a no-op when nothing is focused', () => {
            const focus = controller(2, [1, 1]);
            const onActivate = jest.fn();

            focus.activate(onActivate);

            expect(onActivate).not.toHaveBeenCalled();
        });
    });

    describe('reset', () => {
        it('clears focus back to null', () => {
            const focus = controller(2, [1, 1]);
            focus.moveRow(1);

            focus.reset();

            expect(focus.focus()).toBeNull();
        });
    });
});
