import type { TvLiveCategory, TvLiveSource, TvSettingsItem } from '@iptvnator/tv/util';
import { TvLivePanesController, type TvLivePanesConfig } from './tv-live-panes.controller';

const CATEGORIES: TvLiveCategory[] = [
    { id: 'all', name: 'All' },
    { id: 'sports', name: 'Sports' },
];
const SOURCES: TvLiveSource[] = [
    { id: 'p1', title: 'Primary', kind: 'xtream' },
    { id: 'p2', title: 'Secondary', kind: 'm3u' },
];
const SETTINGS_ITEMS: TvSettingsItem[] = [
    { id: 'language', label: 'Language', kind: 'select', valueLabel: 'English' },
    { id: 'theme', label: 'Theme', kind: 'select', valueLabel: 'System' },
];

function fakeConfig(overrides: Partial<TvLivePanesConfig> = {}): TvLivePanesConfig & {
    onCategorySelected: jest.Mock;
    selectPlaylist: jest.Mock;
    adjustSetting: jest.Mock;
    onChannelActivated: jest.Mock;
    adjustVolume: jest.Mock;
    togglePlayPause: jest.Mock;
    dismissInfoOverlay: jest.Mock;
} {
    return {
        categories: () => CATEGORIES,
        sources: () => SOURCES,
        settingsItems: () => SETTINGS_ITEMS,
        activePlaylistId: () => 'p1',
        channelColumns: () => 1,
        channelCount: () => 3,
        activeChannelIndex: () => null,
        idleTimeoutMs: () => 5000,
        onCategorySelected: jest.fn(),
        selectPlaylist: jest.fn().mockResolvedValue(undefined),
        adjustSetting: jest.fn(),
        onChannelActivated: jest.fn(),
        adjustVolume: jest.fn(),
        togglePlayPause: jest.fn(),
        dismissInfoOverlay: jest.fn(),
        ...overrides,
    };
}

describe('TvLivePanesController', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('starts visible on the channels pane and collapses after idleTimeoutMs', () => {
        const panes = new TvLivePanesController(fakeConfig());

        expect(panes.panelVisible()).toBe(true);
        expect(panes.activePane()).toBe('channels');

        jest.advanceTimersByTime(5000);

        expect(panes.panelVisible()).toBe(false);
    });

    it('destroy() stops the pending idle timer', () => {
        const panes = new TvLivePanesController(fakeConfig());
        panes.destroy();

        jest.advanceTimersByTime(10_000);

        expect(panes.panelVisible()).toBe(true);
    });

    describe('onDirection', () => {
        it('moves the channels controller and dismisses the info overlay', () => {
            const config = fakeConfig();
            const panes = new TvLivePanesController(config);

            panes.onDirection('down');

            expect(panes.channelsController.focusedIndex()).toBe(0);
            expect(config.dismissInfoOverlay).toHaveBeenCalled();
        });

        it('hands off to the pills pane when Up leaves the first row (list mode)', () => {
            const config = fakeConfig(); // default channelColumns: () => 1
            const panes = new TvLivePanesController(config);
            panes.channelsController.focusedIndex.set(0);

            panes.onDirection('up');

            expect(panes.activePane()).toBe('pills');
        });

        it('hands off to the pills pane when Left leaves the leftmost column (grid mode)', () => {
            const config = fakeConfig({ channelColumns: () => 4, channelCount: () => 6 });
            const panes = new TvLivePanesController(config);
            panes.channelsController.focusedIndex.set(4); // leftmost column, second row

            panes.onDirection('left');

            expect(panes.activePane()).toBe('pills');
        });

        it('does not hand off on Left from a non-leftmost column (grid mode)', () => {
            const config = fakeConfig({ channelColumns: () => 4, channelCount: () => 6 });
            const panes = new TvLivePanesController(config);
            panes.channelsController.focusedIndex.set(5);

            panes.onDirection('left');

            expect(panes.activePane()).toBe('channels');
            expect(panes.channelsController.focusedIndex()).toBe(4);
        });

        it('Up/Down move within the grid and never hand off in grid mode', () => {
            const config = fakeConfig({ channelColumns: () => 4, channelCount: () => 6 });
            const panes = new TvLivePanesController(config);
            panes.channelsController.focusedIndex.set(1); // first row

            panes.onDirection('up'); // would hand off in list mode; not here

            expect(panes.activePane()).toBe('channels');
            expect(panes.channelsController.focusedIndex()).toBe(1); // no-op: nothing above
        });

        it('adjusts volume instead of navigating while immersive', () => {
            const config = fakeConfig();
            const panes = new TvLivePanesController(config);
            panes.collapseToImmersive();

            panes.onDirection('up');

            expect(config.adjustVolume).toHaveBeenCalledWith(expect.any(Number));
            expect(panes.panelVisible()).toBe(false);
        });

        it('Left reveals the panel while immersive without adjusting volume', () => {
            const config = fakeConfig();
            const panes = new TvLivePanesController(config);
            panes.collapseToImmersive();

            panes.onDirection('left');

            expect(panes.panelVisible()).toBe(true);
            expect(config.adjustVolume).not.toHaveBeenCalled();
        });

        it('in the settings pane, Left/Right adjust the focused row instead of moving focus', () => {
            const config = fakeConfig();
            const panes = new TvLivePanesController(config);
            panes.onToggleSettings();

            panes.onDirection('right');

            expect(config.adjustSetting).toHaveBeenCalledWith('language', 'right');
            expect(panes.settingsController.focusedIndex()).toBe(0);
        });
    });

    describe('onActivate', () => {
        it('activates the focused category via the pills pane', () => {
            const config = fakeConfig();
            const panes = new TvLivePanesController(config);
            panes.activePane.set('pills');
            panes.pillsController.focusedIndex.set(1);

            panes.onActivate();

            expect(config.onCategorySelected).toHaveBeenCalledWith('sports');
            expect(panes.selectedCategoryId()).toBe('sports');
            expect(panes.activePane()).toBe('channels');
        });

        it('activates the focused channel via onChannelActivated', () => {
            const config = fakeConfig();
            const panes = new TvLivePanesController(config);
            panes.channelsController.focusedIndex.set(1);

            panes.onActivate();

            expect(config.onChannelActivated).toHaveBeenCalledWith(1);
        });

        it('toggles play/pause instead of activating while immersive', () => {
            const config = fakeConfig();
            const panes = new TvLivePanesController(config);
            panes.collapseToImmersive();

            panes.onActivate();

            expect(config.togglePlayPause).toHaveBeenCalled();
        });

        it('does nothing on the settings pane — there is nothing to confirm', () => {
            const config = fakeConfig();
            const panes = new TvLivePanesController(config);
            panes.onToggleSettings();

            panes.onActivate();

            expect(config.onChannelActivated).not.toHaveBeenCalled();
            expect(panes.activePane()).toBe('settings');
        });
    });

    describe('onToggleSources / onToggleSettings', () => {
        it('opens the sources pane focused on the active playlist and returns on a second press', () => {
            const config = fakeConfig({ activePlaylistId: () => 'p2' });
            const panes = new TvLivePanesController(config);

            panes.onToggleSources();
            expect(panes.activePane()).toBe('sources');
            expect(panes.sourcesController.focusedIndex()).toBe(1);

            panes.onToggleSources();
            expect(panes.activePane()).toBe('channels');
        });

        it('remembers the pane it was opened from, not just "channels"', () => {
            const config = fakeConfig();
            const panes = new TvLivePanesController(config);
            panes.activePane.set('pills');

            panes.onToggleSettings();
            expect(panes.activePane()).toBe('settings');

            panes.onBack();
            expect(panes.activePane()).toBe('pills');
        });

        it('falls back to focusing the first row when the active id has no match', () => {
            const config = fakeConfig({ activePlaylistId: () => 'unknown' });
            const panes = new TvLivePanesController(config);

            panes.onToggleSources();

            expect(panes.sourcesController.focusedIndex()).toBe(0);
        });

        it('opens settings directly in one press from immersive, unlike onToggleSources', () => {
            const config = fakeConfig();
            const panes = new TvLivePanesController(config);
            panes.collapseToImmersive();

            panes.onToggleSettings();

            expect(panes.activePane()).toBe('settings');
            expect(panes.panelVisible()).toBe(true);
        });

        it('remembers the pre-immersive pane so a second press (now visible) returns to it', () => {
            const config = fakeConfig();
            const panes = new TvLivePanesController(config);
            panes.activePane.set('pills');
            panes.collapseToImmersive();

            panes.onToggleSettings(); // -> settings, straight from immersive
            panes.onToggleSettings(); // second press, now visible -> back to pills

            expect(panes.activePane()).toBe('pills');
        });
    });

    describe('onCategoryStep', () => {
        it('steps forward, starting from the first category when nothing is selected yet', () => {
            const config = fakeConfig();
            const panes = new TvLivePanesController(config);

            panes.onCategoryStep('next');
            expect(panes.selectedCategoryId()).toBe('all');

            panes.onCategoryStep('next');

            expect(config.onCategorySelected).toHaveBeenCalledWith('sports');
            expect(panes.selectedCategoryId()).toBe('sports');
        });

        it('no-ops past the first and last category', () => {
            const config = fakeConfig();
            const panes = new TvLivePanesController(config);

            panes.onCategoryStep('previous'); // already unset/first -> no-op
            expect(panes.selectedCategoryId()).toBeNull();

            panes.onCategoryStep('next'); // -> sports (last)
            panes.onCategoryStep('next'); // no-op

            expect(panes.selectedCategoryId()).toBe('sports');
        });

        describe('while immersive', () => {
            it('steps the playing channel instead of the category, and syncs channelsController', () => {
                const config = fakeConfig({ activeChannelIndex: () => 1 });
                const panes = new TvLivePanesController(config);
                panes.collapseToImmersive();

                panes.onCategoryStep('next');

                expect(config.onChannelActivated).toHaveBeenCalledWith(2);
                expect(panes.channelsController.focusedIndex()).toBe(2);
                expect(panes.panelVisible()).toBe(false); // stays immersive
            });

            it('steps backward too', () => {
                const config = fakeConfig({ activeChannelIndex: () => 1 });
                const panes = new TvLivePanesController(config);
                panes.collapseToImmersive();

                panes.onCategoryStep('previous');

                expect(config.onChannelActivated).toHaveBeenCalledWith(0);
            });

            it('no-ops at the first/last channel instead of wrapping', () => {
                const config = fakeConfig({ activeChannelIndex: () => 0, channelCount: () => 3 });
                const panes = new TvLivePanesController(config);
                panes.collapseToImmersive();

                panes.onCategoryStep('previous');
                expect(config.onChannelActivated).not.toHaveBeenCalled();

                config.activeChannelIndex = () => 2; // last of 3
                panes.onCategoryStep('next');
                expect(config.onChannelActivated).not.toHaveBeenCalled();
            });

            it('no-ops when nothing has played yet', () => {
                const config = fakeConfig({ activeChannelIndex: () => null });
                const panes = new TvLivePanesController(config);
                panes.collapseToImmersive();

                panes.onCategoryStep('next');

                expect(config.onChannelActivated).not.toHaveBeenCalled();
            });

            it('never reveals the panel or steps the category', () => {
                const config = fakeConfig({ activeChannelIndex: () => 0 });
                const panes = new TvLivePanesController(config);
                panes.collapseToImmersive();

                panes.onCategoryStep('next');

                expect(panes.panelVisible()).toBe(false);
                expect(config.onCategorySelected).not.toHaveBeenCalled();
            });
        });
    });

    describe('selectSource (via onActivate on the sources pane)', () => {
        it('switches playlist and lands on the first category', async () => {
            const config = fakeConfig();
            const panes = new TvLivePanesController(config);
            panes.onToggleSources();
            panes.sourcesController.focusedIndex.set(1);

            panes.onActivate();
            await Promise.resolve();
            await Promise.resolve();

            expect(config.selectPlaylist).toHaveBeenCalledWith('p2');
            expect(panes.activePane()).toBe('channels');
        });

        it('falls back to the pills pane when the new source has no categories', async () => {
            const config = fakeConfig({ categories: () => [] });
            const panes = new TvLivePanesController(config);
            panes.onToggleSources();

            panes.onActivate();
            await Promise.resolve();
            await Promise.resolve();

            expect(panes.activePane()).toBe('pills');
        });
    });
});
