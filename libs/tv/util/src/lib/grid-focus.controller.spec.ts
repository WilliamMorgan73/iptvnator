import { GridFocusController, GridFocusHost } from './grid-focus.controller';

function hostOf(itemCount: number, columnCount: number): GridFocusHost {
    return {
        itemCount: () => itemCount,
        columnCount: () => columnCount,
    };
}

describe('GridFocusController', () => {
    describe('initial state', () => {
        it('starts with no focused index', () => {
            const controller = new GridFocusController(hostOf(5, 1));
            expect(controller.focusedIndex()).toBeNull();
        });

        it('seeds to index 0 on the first move, regardless of direction', () => {
            (['up', 'down', 'left', 'right'] as const).forEach((direction) => {
                const controller = new GridFocusController(hostOf(5, 1));
                controller.move(direction);
                expect(controller.focusedIndex()).toBe(0);
            });
        });

        it('clears focus when the list is empty', () => {
            const controller = new GridFocusController(hostOf(0, 1));
            controller.move('down');
            expect(controller.focusedIndex()).toBeNull();
        });
    });

    describe('single item (count=1)', () => {
        it.each(['up', 'down', 'left', 'right'] as const)(
            'no-ops on %s',
            (direction) => {
                const controller = new GridFocusController(hostOf(1, 1));
                controller.move('down'); // seed to 0
                controller.move(direction);
                expect(controller.focusedIndex()).toBe(0);
            }
        );
    });

    describe('vertical list (columnCount=1)', () => {
        it('moves down and up by one', () => {
            const controller = new GridFocusController(hostOf(3, 1));
            controller.move('down'); // seed to 0
            controller.move('down');
            expect(controller.focusedIndex()).toBe(1);
            controller.move('down');
            expect(controller.focusedIndex()).toBe(2);
            controller.move('up');
            expect(controller.focusedIndex()).toBe(1);
        });

        it('no-ops past the top and bottom boundary', () => {
            const controller = new GridFocusController(hostOf(3, 1));
            controller.move('down'); // seed to 0
            controller.move('up');
            expect(controller.focusedIndex()).toBe(0);

            controller.move('down');
            controller.move('down');
            expect(controller.focusedIndex()).toBe(2);
            controller.move('down');
            expect(controller.focusedIndex()).toBe(2);
        });

        it('left/right always no-op', () => {
            const controller = new GridFocusController(hostOf(3, 1));
            controller.move('down');
            controller.move('down');
            expect(controller.focusedIndex()).toBe(1);
            controller.move('left');
            expect(controller.focusedIndex()).toBe(1);
            controller.move('right');
            expect(controller.focusedIndex()).toBe(1);
        });
    });

    describe('single-row horizontal list (columnCount=itemCount)', () => {
        it('moves right and left by one', () => {
            const controller = new GridFocusController(hostOf(4, 4));
            controller.move('right'); // seed to 0
            controller.move('right');
            expect(controller.focusedIndex()).toBe(1);
            controller.move('right');
            expect(controller.focusedIndex()).toBe(2);
            controller.move('left');
            expect(controller.focusedIndex()).toBe(1);
        });

        it('no-ops past the first and last column', () => {
            const controller = new GridFocusController(hostOf(4, 4));
            controller.move('right'); // seed to 0
            controller.move('left');
            expect(controller.focusedIndex()).toBe(0);

            controller.move('right');
            controller.move('right');
            controller.move('right');
            expect(controller.focusedIndex()).toBe(3);
            controller.move('right');
            expect(controller.focusedIndex()).toBe(3);
        });

        it('up/down always no-op', () => {
            const controller = new GridFocusController(hostOf(4, 4));
            controller.move('right');
            controller.move('right');
            expect(controller.focusedIndex()).toBe(1);
            controller.move('up');
            expect(controller.focusedIndex()).toBe(1);
            controller.move('down');
            expect(controller.focusedIndex()).toBe(1);
        });
    });

    describe('grid with a ragged last row (count=7, columns=3)', () => {
        it('no-ops moving left from the first column of a row', () => {
            const controller = new GridFocusController(hostOf(7, 3));
            controller.focusedIndex.set(3);
            controller.move('left');
            expect(controller.focusedIndex()).toBe(3);
        });

        it('no-ops moving right from the last column of a full row', () => {
            const controller = new GridFocusController(hostOf(7, 3));
            controller.focusedIndex.set(2);
            controller.move('right');
            expect(controller.focusedIndex()).toBe(2);
        });

        it('moves down into a shorter row and no-ops past its end', () => {
            const controller = new GridFocusController(hostOf(7, 3));
            controller.focusedIndex.set(3); // row 1, col 0
            controller.move('down');
            expect(controller.focusedIndex()).toBe(6); // row 2, col 0 (only item)
            controller.move('down');
            expect(controller.focusedIndex()).toBe(6);
        });

        it('no-ops moving right when the ragged row has no item there', () => {
            const controller = new GridFocusController(hostOf(7, 3));
            controller.focusedIndex.set(6); // row 2, col 0, alone
            controller.move('right');
            expect(controller.focusedIndex()).toBe(6);
        });

        it('no-ops moving down when the row below is missing that column', () => {
            const controller = new GridFocusController(hostOf(7, 3));
            controller.focusedIndex.set(4); // row 1, col 1
            controller.move('down');
            expect(controller.focusedIndex()).toBe(4);
        });

        it('moves up from the ragged last row back into a full row', () => {
            const controller = new GridFocusController(hostOf(7, 3));
            controller.focusedIndex.set(6);
            controller.move('up');
            expect(controller.focusedIndex()).toBe(3);
        });
    });

    describe('activate', () => {
        it('invokes the callback with the focused index', () => {
            const controller = new GridFocusController(hostOf(3, 1));
            controller.focusedIndex.set(1);
            const onActivate = jest.fn();
            controller.activate(onActivate);
            expect(onActivate).toHaveBeenCalledTimes(1);
            expect(onActivate).toHaveBeenCalledWith(1);
        });

        it('does not invoke the callback when nothing is focused', () => {
            const controller = new GridFocusController(hostOf(3, 1));
            const onActivate = jest.fn();
            controller.activate(onActivate);
            expect(onActivate).not.toHaveBeenCalled();
        });

        it('never mutates focusedIndex', () => {
            const controller = new GridFocusController(hostOf(3, 1));
            controller.focusedIndex.set(1);
            controller.activate(() => undefined);
            expect(controller.focusedIndex()).toBe(1);
        });
    });

    describe('back', () => {
        it('invokes only its own callback, unconditionally', () => {
            const controller = new GridFocusController(hostOf(3, 1));
            const onBack = jest.fn();
            controller.back(onBack);
            expect(onBack).toHaveBeenCalledTimes(1);
        });

        it('never mutates focusedIndex', () => {
            const controller = new GridFocusController(hostOf(3, 1));
            controller.focusedIndex.set(2);
            controller.back(() => undefined);
            expect(controller.focusedIndex()).toBe(2);
        });
    });
});
