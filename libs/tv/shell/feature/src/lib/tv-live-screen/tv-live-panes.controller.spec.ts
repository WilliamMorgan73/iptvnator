import type { RecordingItem } from '@iptvnator/services';
import type {
    TvLiveCategory,
    TvLiveChannel,
    TvLiveSource,
    TvSettingsItem,
} from '@iptvnator/tv/util';
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
const RECENT_CHANNELS: TvLiveChannel[] = [
    { id: 'r1', name: 'Recent 1', categoryId: 'all', sourceKind: 'xtream', playRef: null },
    { id: 'r2', name: 'Recent 2', categoryId: 'sports', sourceKind: 'xtream', playRef: null },
];
const RECORDINGS: RecordingItem[] = [
    {
        id: 1,
        status: 'completed',
        filePath: '/downloads/rec1.ts',
        channelName: 'Recording 1',
        startedAt: '2026-09-27T12:00:00Z',
        fileAvailability: 'available',
    },
    {
        id: 2,
        status: 'recording',
        filePath: '/downloads/rec2.ts',
        channelName: 'Recording 2',
        startedAt: '2026-09-27T13:00:00Z',
        fileAvailability: 'not-applicable',
    },
];

function fakeConfig(overrides: Partial<TvLivePanesConfig> = {}): TvLivePanesConfig & {
    onCategorySelected: jest.Mock;
    selectPlaylist: jest.Mock;
    adjustSetting: jest.Mock;
    onChannelActivated: jest.Mock;
    onRecentChannelActivated: jest.Mock;
    onRecordingActivated: jest.Mock;
    openGuide: jest.Mock;
    closeGuide: jest.Mock;
    onGuideDirection: jest.Mock;
    onGuideActivate: jest.Mock;
    onGuideStepDay: jest.Mock;
    adjustVolume: jest.Mock;
    togglePlayPause: jest.Mock;
    dismissInfoOverlay: jest.Mock;
    onAddSourceRequested: jest.Mock;
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
        recentChannels: () => RECENT_CHANNELS,
        recordings: () => RECORDINGS,
        onCategorySelected: jest.fn(),
        selectPlaylist: jest.fn().mockResolvedValue(undefined),
        adjustSetting: jest.fn(),
        onChannelActivated: jest.fn(),
        onRecordingActivated: jest.fn(),
        onRecentChannelActivated: jest.fn(),
        openGuide: jest.fn(),
        closeGuide: jest.fn(),
        onGuideDirection: jest.fn(),
        onGuideActivate: jest.fn(),
        onGuideStepDay: jest.fn(),
        adjustVolume: jest.fn(),
        togglePlayPause: jest.fn(),
        dismissInfoOverlay: jest.fn(),
        onAddSourceRequested: jest.fn(),
        ...overrides,
    } as ReturnType<typeof fakeConfig>;
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

    describe('onToggleRecent', () => {
        it('opens the recent pane focused on the first row and returns on a second press', () => {
            const config = fakeConfig();
            const panes = new TvLivePanesController(config);

            panes.onToggleRecent();
            expect(panes.activePane()).toBe('recent');
            expect(panes.recentController.focusedIndex()).toBe(0);

            panes.onToggleRecent();
            expect(panes.activePane()).toBe('channels');
        });

        it('remembers the pane it was opened from', () => {
            const config = fakeConfig();
            const panes = new TvLivePanesController(config);
            panes.activePane.set('pills');

            panes.onToggleRecent();
            expect(panes.activePane()).toBe('recent');

            panes.onBack();
            expect(panes.activePane()).toBe('pills');
        });

        it('focuses nothing when there is no recent history', () => {
            const config = fakeConfig({ recentChannels: () => [] });
            const panes = new TvLivePanesController(config);

            panes.onToggleRecent();

            expect(panes.recentController.focusedIndex()).toBeNull();
        });

        it('Up/Down moves focus across recent rows', () => {
            const config = fakeConfig();
            const panes = new TvLivePanesController(config);
            panes.onToggleRecent();

            panes.onDirection('down');

            expect(panes.recentController.focusedIndex()).toBe(1);
        });

        it('activating a row calls onRecentChannelActivated with the channel', () => {
            const config = fakeConfig();
            const panes = new TvLivePanesController(config);
            panes.onToggleRecent();
            panes.onDirection('down');

            panes.onActivate();

            expect(config.onRecentChannelActivated).toHaveBeenCalledWith(
                RECENT_CHANNELS[1]
            );
        });

        it('activating with nothing focused is a no-op', () => {
            const config = fakeConfig({ recentChannels: () => [] });
            const panes = new TvLivePanesController(config);
            panes.onToggleRecent();

            panes.onActivate();

            expect(config.onRecentChannelActivated).not.toHaveBeenCalled();
        });

        it('does not fall through to channel/category navigation while open', () => {
            const config = fakeConfig();
            const panes = new TvLivePanesController(config);
            panes.onToggleRecent();

            panes.onActivate();

            expect(config.onChannelActivated).not.toHaveBeenCalled();
        });
    });

    describe('onToggleRecordings', () => {
        it('opens the recordings pane focused on the first row and returns on a second press', () => {
            const config = fakeConfig();
            const panes = new TvLivePanesController(config);

            panes.onToggleRecordings();
            expect(panes.activePane()).toBe('recordings');
            expect(panes.recordingsController.focusedIndex()).toBe(0);

            panes.onToggleRecordings();
            expect(panes.activePane()).toBe('channels');
        });

        it('Up/Down moves focus across recording rows', () => {
            const config = fakeConfig();
            const panes = new TvLivePanesController(config);
            panes.onToggleRecordings();

            panes.onDirection('down');

            expect(panes.recordingsController.focusedIndex()).toBe(1);
        });

        it('activating a playable row calls onRecordingActivated', () => {
            const config = fakeConfig();
            const panes = new TvLivePanesController(config);
            panes.onToggleRecordings();

            panes.onActivate();

            expect(config.onRecordingActivated).toHaveBeenCalledWith(
                RECORDINGS[0]
            );
        });

        it('does not activate a row that is still recording', () => {
            const config = fakeConfig();
            const panes = new TvLivePanesController(config);
            panes.onToggleRecordings();
            panes.onDirection('down'); // focus RECORDINGS[1], status: 'recording'

            panes.onActivate();

            expect(config.onRecordingActivated).not.toHaveBeenCalled();
        });

        it('focuses nothing when there are no recordings', () => {
            const config = fakeConfig({ recordings: () => [] });
            const panes = new TvLivePanesController(config);

            panes.onToggleRecordings();

            expect(panes.recordingsController.focusedIndex()).toBeNull();
        });
    });

    describe('onToggleGuide', () => {
        it('opens the guide pane via config.openGuide() and returns on a second press', () => {
            const config = fakeConfig();
            const panes = new TvLivePanesController(config);

            panes.onToggleGuide();
            expect(panes.activePane()).toBe('guide');
            expect(config.openGuide).toHaveBeenCalledTimes(1);

            panes.onToggleGuide();
            expect(panes.activePane()).toBe('channels');
            expect(config.closeGuide).toHaveBeenCalledTimes(1);
        });

        it('remembers the pane it was opened from', () => {
            const config = fakeConfig();
            const panes = new TvLivePanesController(config);
            panes.activePane.set('pills');

            panes.onToggleGuide();
            expect(panes.activePane()).toBe('guide');

            panes.onBack();
            expect(panes.activePane()).toBe('pills');
            expect(config.closeGuide).toHaveBeenCalledTimes(1);
        });

        it('delegates direction/activate/day-step to the config while open', () => {
            const config = fakeConfig();
            const panes = new TvLivePanesController(config);
            panes.onToggleGuide();

            panes.onDirection('down');
            panes.onActivate();
            panes.onCategoryStep('next');

            expect(config.onGuideDirection).toHaveBeenCalledWith('down');
            expect(config.onGuideActivate).toHaveBeenCalledTimes(1);
            expect(config.onGuideStepDay).toHaveBeenCalledWith('next');
            expect(config.onChannelActivated).not.toHaveBeenCalled();
            expect(config.onCategorySelected).not.toHaveBeenCalled();
        });

        it('wakes the panel from immersive instead of opening', () => {
            const config = fakeConfig();
            const panes = new TvLivePanesController(config);
            panes.collapseToImmersive();

            panes.onToggleGuide();

            expect(panes.panelVisible()).toBe(true);
            expect(panes.activePane()).not.toBe('guide');
            expect(config.openGuide).not.toHaveBeenCalled();
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

        it('activating the synthetic trailing row requests Add Source instead of selecting a playlist', async () => {
            const config = fakeConfig();
            const panes = new TvLivePanesController(config);
            panes.onToggleSources();
            panes.sourcesController.focusedIndex.set(SOURCES.length);

            panes.onActivate();
            await Promise.resolve();

            expect(config.onAddSourceRequested).toHaveBeenCalledTimes(1);
            expect(config.selectPlaylist).not.toHaveBeenCalled();
        });

        it('can focus the trailing row by moving past the last real source', () => {
            const config = fakeConfig();
            const panes = new TvLivePanesController(config);
            panes.onToggleSources();
            panes.sourcesController.focusedIndex.set(SOURCES.length - 1);

            panes.onDirection('down');

            expect(panes.sourcesController.focusedIndex()).toBe(SOURCES.length);
        });
    });
});
