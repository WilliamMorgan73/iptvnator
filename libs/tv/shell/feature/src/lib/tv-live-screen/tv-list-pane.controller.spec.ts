import { TvListPaneController } from './tv-list-pane.controller';

describe('TvListPaneController', () => {
    it('open() sets the given initial index', () => {
        const controller = new TvListPaneController({ itemCount: () => 3 });

        controller.open(1);

        expect(controller.focusedIndex()).toBe(1);
    });

    it('open(null) focuses nothing, for an empty list', () => {
        const controller = new TvListPaneController({ itemCount: () => 0 });

        controller.open(null);

        expect(controller.focusedIndex()).toBeNull();
    });

    it('move() delegates to the underlying grid, clamped at boundaries', () => {
        const controller = new TvListPaneController({ itemCount: () => 2 });
        controller.open(0);

        controller.move('down');
        expect(controller.focusedIndex()).toBe(1);

        controller.move('down'); // no-op at the boundary
        expect(controller.focusedIndex()).toBe(1);
    });

    it('activate() invokes the callback with the focused index', () => {
        const controller = new TvListPaneController({ itemCount: () => 2 });
        controller.open(1);
        const onActivate = jest.fn();

        controller.activate(onActivate);

        expect(onActivate).toHaveBeenCalledWith(1);
    });

    it('activate() is a no-op when nothing is focused', () => {
        const controller = new TvListPaneController({ itemCount: () => 0 });
        controller.open(null);
        const onActivate = jest.fn();

        controller.activate(onActivate);

        expect(onActivate).not.toHaveBeenCalled();
    });
});
