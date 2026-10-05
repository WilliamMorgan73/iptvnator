import {
    TvDashboardController,
    type TvDashboardConfig,
    type TvDashboardEntry,
} from './tv-dashboard.controller';

const ENTRIES: readonly TvDashboardEntry[] = [
    { id: 'live', label: 'Live TV' },
    { id: 'recent', label: 'Recently Viewed' },
    { id: 'recordings', label: 'Recordings' },
];

function fakeConfig(
    overrides: Partial<TvDashboardConfig> = {}
): TvDashboardConfig & { onSelect: jest.Mock; onExit: jest.Mock } {
    return {
        entries: () => ENTRIES,
        onSelect: jest.fn(),
        onExit: jest.fn(),
        ...overrides,
    } as ReturnType<typeof fakeConfig>;
}

describe('TvDashboardController', () => {
    it('focuses the first entry initially', () => {
        const controller = new TvDashboardController(fakeConfig());

        expect(controller.entriesController.focusedIndex()).toBe(0);
    });

    it('moves focus down and up through the entry list', () => {
        const controller = new TvDashboardController(fakeConfig());

        controller.onDirection('down');
        expect(controller.entriesController.focusedIndex()).toBe(1);

        controller.onDirection('down');
        expect(controller.entriesController.focusedIndex()).toBe(2);

        controller.onDirection('up');
        expect(controller.entriesController.focusedIndex()).toBe(1);
    });

    it('does not move past the first or last entry', () => {
        const controller = new TvDashboardController(fakeConfig());

        controller.onDirection('up');
        expect(controller.entriesController.focusedIndex()).toBe(0);

        controller.onDirection('down');
        controller.onDirection('down');
        controller.onDirection('down');
        expect(controller.entriesController.focusedIndex()).toBe(2);
    });

    it('activates the focused entry via onSelect', () => {
        const config = fakeConfig();
        const controller = new TvDashboardController(config);
        controller.onDirection('down');

        controller.onActivate();

        expect(config.onSelect).toHaveBeenCalledWith(ENTRIES[1]);
    });

    it('calls onExit on Back', () => {
        const config = fakeConfig();
        const controller = new TvDashboardController(config);

        controller.onBack();

        expect(config.onExit).toHaveBeenCalledTimes(1);
    });
});
