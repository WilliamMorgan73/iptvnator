import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import {
    GamepadInputService,
    TvLiveCatalogFacade,
    TvPendingPaneService,
} from '@iptvnator/tv/data-access';
import type {
    TvEpgGuideAdapter,
    TvGamepadAction,
    TvLiveCategory,
    TvLiveChannel,
    TvLiveSource,
} from '@iptvnator/tv/util';
import {
    RecordingsService,
    SettingsStore,
    type RecordingItem,
} from '@iptvnator/services';
import { TvPlaybackController } from '@iptvnator/tv/ui';
import {
    Language,
    StreamFormat,
    Theme,
    VideoPlayer,
    type Settings,
    type TvRecordingStartResult,
} from '@iptvnator/shared/interfaces';
import { TvLiveScreenComponent } from './tv-live-screen.component';

const BASE_SETTINGS: Settings = {
    player: VideoPlayer.VideoJs,
    epgUrl: [],
    streamFormat: StreamFormat.AutoStreamFormat,
    openStreamOnDoubleClick: false,
    language: Language.ENGLISH,
    showCaptions: false,
    showDashboard: true,
    startupBehavior: 'first-view' as Settings['startupBehavior'],
    theme: Theme.SystemTheme,
    mpvPlayerPath: '',
    mpvPlayerArguments: '',
    mpvReuseInstance: false,
    vlcPlayerPath: '',
    vlcPlayerArguments: '',
    vlcReuseInstance: false,
    remoteControl: false,
    remoteControlPort: 8765,
    stripCountryPrefix: false,
    epgOffsetMinutes: 0,
    tvIdleTimeoutSeconds: 5,
    tvBrowseMode: 'list',
};

/** `getSettings()`/`updateSettings()` only — everything `TvLiveScreenComponent`
 * itself calls. `updateSettings` patches the same signal `getSettings()`
 * reads, mirroring the real store closely enough for `settingsItems()`/
 * `idleTimeoutMs()` to react the way the real computed()s do. */
class FakeSettingsStore {
    private readonly settings = signal<Settings>(BASE_SETTINGS);

    readonly updateSettings = jest.fn(async (patch: Partial<Settings>) => {
        this.settings.update((current) => ({ ...current, ...patch }));
    });

    getSettings(): Settings {
        return this.settings();
    }
}

const CATEGORIES: TvLiveCategory[] = [
    { id: 'all', name: 'All' },
    { id: 'sports', name: 'Sports' },
    { id: 'news', name: 'News' },
    { id: 'movies', name: 'Movies' },
];

function channel(
    id: string,
    categoryId: string,
    channelNumber?: number
): TvLiveChannel {
    return {
        id,
        name: `Channel ${id}`,
        categoryId,
        sourceKind: 'xtream',
        playRef: null,
        channelNumber,
    };
}

const SPORTS_CHANNELS = [
    channel('sports-1', 'sports', 101),
    channel('sports-2', 'sports', 102),
];
const NEWS_CHANNELS = [channel('news-1', 'news', 301)];
const MOVIES_CHANNELS: TvLiveChannel[] = [];
const ALL_CHANNELS = [...SPORTS_CHANNELS, ...NEWS_CHANNELS, ...MOVIES_CHANNELS];

const CHANNELS_BY_CATEGORY: Record<string, TvLiveChannel[]> = {
    all: ALL_CHANNELS,
    sports: SPORTS_CHANNELS,
    news: NEWS_CHANNELS,
    movies: MOVIES_CHANNELS,
};

const SOURCES: TvLiveSource[] = [
    { id: 'p1', title: 'Primary', kind: 'xtream' },
    { id: 'p2', title: 'Secondary', kind: 'm3u' },
];

const SECONDARY_CATEGORIES: TvLiveCategory[] = [
    { id: 'other', name: 'Other' },
];
const SECONDARY_CHANNELS: Record<string, TvLiveChannel[]> = {
    other: [channel('other-1', 'other')],
};

/** The full, cross-category list per playlist — kept separate from
 * `CHANNELS_BY_CATEGORY`'s `'all'` bucket alias so flattening it can't
 * double-count. */
const ALL_CHANNELS_BY_PLAYLIST: Record<string, TvLiveChannel[]> = {
    p1: ALL_CHANNELS,
    p2: SECONDARY_CHANNELS['other'],
};

class FakeTvLiveCatalogFacade {
    readonly status = signal<'loading' | 'ready' | 'no-playlists' | 'error'>(
        'loading'
    );
    readonly playlistTitle = signal<string | null>(null);
    readonly activePlaylistId = signal<string | null>(null);
    readonly sources = signal<TvLiveSource[]>(SOURCES);
    private readonly selectedCategoryId = signal('all');

    private readonly categoriesByPlaylist: Record<string, TvLiveCategory[]> = {
        p1: CATEGORIES,
        p2: SECONDARY_CATEGORIES,
    };
    private readonly channelsByPlaylist: Record<
        string,
        Record<string, TvLiveChannel[]>
    > = {
        p1: CHANNELS_BY_CATEGORY,
        p2: SECONDARY_CHANNELS,
    };

    readonly initialize = jest.fn(async () => {
        this.activePlaylistId.set('p1');
        this.status.set('ready');
        this.playlistTitle.set('Test Playlist');
    });
    readonly resolvePlayback = jest
        .fn()
        .mockResolvedValue({ streamUrl: 'https://stream.test' });

    readonly selectPlaylist = jest.fn(async (id: string) => {
        this.activePlaylistId.set(id);
        this.playlistTitle.set(
            SOURCES.find((source) => source.id === id)?.title ?? null
        );
        this.selectedCategoryId.set(
            (this.categoriesByPlaylist[id] ?? [])[0]?.id ?? 'all'
        );
        this.status.set('ready');
    });

    // Reads the `activePlaylistId` signal (not a plain field) so the real
    // component's `computed(() => this.catalog.categories())` — which tracks
    // signal reads made *during* the computation, exactly like the real
    // facade's `categories()` reading its `activeAdapter` signal — picks up
    // a `selectPlaylist()` switch as a dependency change and recomputes.
    categories(): TvLiveCategory[] {
        return this.categoriesByPlaylist[this.activePlaylistId() ?? 'p1'] ?? [];
    }

    selectCategory(categoryId: string): void {
        this.selectedCategoryId.set(categoryId);
    }

    channels(): TvLiveChannel[] {
        return (
            this.channelsByPlaylist[this.activePlaylistId() ?? 'p1']?.[
                this.selectedCategoryId()
            ] ?? []
        );
    }

    channelsAcrossCategories(): TvLiveChannel[] {
        return ALL_CHANNELS_BY_PLAYLIST[this.activePlaylistId() ?? 'p1'] ?? [];
    }

    /** Most-recent-first ids, mirroring the real adapters' own
     * recordRecentlyViewed()/recentChannels() round-trip closely enough for
     * integration tests to exercise the shell's activation -> recent-pane
     * path without a real store behind it. */
    private recentIds: string[] = [];

    recordRecentlyViewed(channel: TvLiveChannel): void {
        this.recentIds = [
            channel.id,
            ...this.recentIds.filter((id) => id !== channel.id),
        ];
    }

    recentChannels(): TvLiveChannel[] {
        const byId = new Map(
            this.channelsAcrossCategories().map((channel) => [
                channel.id,
                channel,
            ])
        );
        return this.recentIds
            .map((id) => byId.get(id))
            .filter((channel): channel is TvLiveChannel => channel !== undefined);
    }

    /** Minimal guide adapter — real channels, no programme data. Guide
     * feature tests only exercise focus/activation, not programme rendering
     * (that's `TvEpgGuideController`'s own spec's job). */
    epgGuideAdapter(): TvEpgGuideAdapter {
        const channels = this.channelsAcrossCategories();
        return {
            channels: () =>
                channels.map((c) => ({
                    id: c.id,
                    number: c.channelNumber ?? 0,
                    name: c.name,
                    logoUrl: null,
                })),
            loadPrograms: async () => new Map(),
        };
    }
}

class FakeGamepadInputService {
    readonly actionsSubject = new Subject<TvGamepadAction>();
    readonly actions$ = this.actionsSubject.asObservable();
}

/** Minimal stand-in for `RecordingsService` — only the members the shell
 * actually calls (`recordings()`, `activeRecording()`, `startTvRecording()`,
 * `stopRecording()`). */
class FakeRecordingsService {
    readonly recordings = signal<RecordingItem[]>([]);

    readonly startTvRecording = jest.fn(
        async (): Promise<TvRecordingStartResult> => {
            const recording: RecordingItem = {
                id: this.recordings().length + 1,
                status: 'recording',
                filePath: '/downloads/rec.ts',
                channelName: 'Recorded Channel',
                startedAt: '2026-09-27T12:00:00Z',
                fileAvailability: 'not-applicable',
            };
            this.recordings.update((current) => [...current, recording]);
            return { success: true, recordingId: recording.id };
        }
    );

    readonly stopRecording = jest.fn(async (recordingId: number) => {
        this.recordings.update((current) =>
            current.map((item) =>
                item.id === recordingId
                    ? { ...item, status: 'completed' as const }
                    : item
            )
        );
        return { success: true };
    });

    activeRecording(): RecordingItem | null {
        return (
            this.recordings().find((item) => item.status === 'recording') ??
            null
        );
    }
}

function pressKey(key: string, code?: string): void {
    document.dispatchEvent(
        new KeyboardEvent('keydown', {
            key,
            code,
            bubbles: true,
            cancelable: true,
        })
    );
}

describe('TvLiveScreenComponent', () => {
    let catalog: FakeTvLiveCatalogFacade;
    let settingsStore: FakeSettingsStore;
    let recordingsService: FakeRecordingsService;

    beforeEach(() => {
        catalog = new FakeTvLiveCatalogFacade();
        settingsStore = new FakeSettingsStore();
        recordingsService = new FakeRecordingsService();
        TestBed.configureTestingModule({
            imports: [TvLiveScreenComponent],
            providers: [
                provideRouter([]),
                { provide: TvLiveCatalogFacade, useValue: catalog },
                { provide: GamepadInputService, useClass: FakeGamepadInputService },
                { provide: SettingsStore, useValue: settingsStore },
                { provide: RecordingsService, useValue: recordingsService },
            ],
        });
    });

    async function createFixture() {
        const fixture = TestBed.createComponent(TvLiveScreenComponent);
        fixture.detectChanges();
        await fixture.whenStable();
        return fixture;
    }

    it('initializes the catalog and defaults to the first category', async () => {
        const fixture = await createFixture();
        const component = fixture.componentInstance;

        expect(catalog.initialize).toHaveBeenCalledTimes(1);
        expect(component.status()).toBe('ready');
        expect(component.panes.selectedCategoryId()).toBe('all');
        expect(component.panes.channelsController.focusedIndex()).toBe(0);
        expect(component.panes.panelVisible()).toBe(true);
        expect(component.panes.activePane()).toBe('channels');
    });

    it('renders no-playlists state without crashing', async () => {
        catalog.initialize.mockImplementation(async () => {
            catalog.status.set('no-playlists');
        });
        const fixture = await createFixture();
        expect(fixture.componentInstance.status()).toBe('no-playlists');
        expect(
            fixture.nativeElement.textContent
        ).toContain('No sources configured yet');
        const link = fixture.nativeElement.querySelector('a[href="/add-source"]');
        expect(link).not.toBeNull();
    });

    it('renders an error state without crashing', async () => {
        catalog.initialize.mockImplementation(async () => {
            catalog.status.set('error');
        });
        const fixture = await createFixture();
        expect(fixture.componentInstance.status()).toBe('error');
        expect(fixture.nativeElement.textContent).toContain(
            "Couldn't load your sources"
        );
    });

    it('moves the channel focus down and up within the channels pane', async () => {
        const fixture = await createFixture();
        const component = fixture.componentInstance;

        pressKey('ArrowDown');
        expect(component.panes.channelsController.focusedIndex()).toBe(1);

        pressKey('ArrowUp');
        expect(component.panes.channelsController.focusedIndex()).toBe(0);
    });

    it('hands off to the pills pane on up from the topmost channel row', async () => {
        const fixture = await createFixture();
        const component = fixture.componentInstance;

        pressKey('ArrowUp');
        expect(component.panes.activePane()).toBe('pills');
        expect(component.panes.channelsController.focusedIndex()).toBe(0);
    });

    it('selecting a pill calls catalog.selectCategory and returns focus to channels', async () => {
        const fixture = await createFixture();
        const component = fixture.componentInstance;

        pressKey('ArrowUp'); // -> pills, focused All (index 0)
        pressKey('ArrowRight'); // -> Sports
        pressKey('Enter');

        expect(component.panes.selectedCategoryId()).toBe('sports');
        expect(component.panes.activePane()).toBe('channels');
        expect(component.panes.channelsController.focusedIndex()).toBe(0);
        expect(component.channels().map((c) => c.id)).toEqual([
            'sports-1',
            'sports-2',
        ]);
    });

    it('activating a channel marks it active and collapses to immersive', async () => {
        const fixture = await createFixture();
        const component = fixture.componentInstance;

        pressKey('Enter');

        expect(component.activeChannelId()).toBe('sports-1');
        expect(component.panes.panelVisible()).toBe(false);
    });

    it('Escape collapses the panel to immersive', async () => {
        const fixture = await createFixture();
        pressKey('Escape');
        expect(fixture.componentInstance.panes.panelVisible()).toBe(false);
    });

    describe('categoryStep (gamepad LB/RB, keyboard PageUp/PageDown)', () => {
        it('steps to the next category and selects it', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;

            pressKey('PageDown'); // All -> Sports

            expect(component.panes.selectedCategoryId()).toBe('sports');
            expect(component.panes.pillsController.focusedIndex()).toBe(1);
        });

        it('no-ops past the first and last category', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;

            pressKey('PageUp'); // already first, no-op
            expect(component.panes.selectedCategoryId()).toBe('all');

            pressKey('PageDown');
            pressKey('PageDown');
            pressKey('PageDown'); // -> Movies (last)
            pressKey('PageDown'); // no-op
            expect(component.panes.selectedCategoryId()).toBe('movies');
        });
    });

    describe('gamepad input', () => {
        function gamepadService(): FakeGamepadInputService {
            return TestBed.inject(
                GamepadInputService
            ) as unknown as FakeGamepadInputService;
        }

        it('drives channel focus from a direction action', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;

            gamepadService().actionsSubject.next({
                kind: 'direction',
                direction: 'down',
            });

            expect(component.panes.channelsController.focusedIndex()).toBe(1);
        });
    });

    describe('idle auto-hide', () => {
        beforeEach(() => jest.useFakeTimers());
        afterEach(() => jest.useRealTimers());

        it('collapses to immersive after 5s of no input', async () => {
            const fixture = await createFixture();
            jest.advanceTimersByTime(5000);
            expect(fixture.componentInstance.panes.panelVisible()).toBe(false);
        });

        it('Left redisplays the panel without also performing navigation', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;
            jest.advanceTimersByTime(5000);
            expect(component.panes.panelVisible()).toBe(false);

            pressKey('ArrowLeft');

            expect(component.panes.panelVisible()).toBe(true);
            expect(component.panes.channelsController.focusedIndex()).toBe(0);
        });
    });

    describe('immersive playback controls', () => {
        beforeEach(() => jest.useFakeTimers());
        afterEach(() => jest.useRealTimers());

        async function createImmersiveFixture() {
            const fixture = await createFixture();
            fixture.componentInstance.panes.onBack(); // panel -> immersive
            expect(fixture.componentInstance.panes.panelVisible()).toBe(false);
            return fixture;
        }

        it('Up/Down adjust volume instead of navigating or revealing the panel', async () => {
            const fixture = await createImmersiveFixture();
            const component = fixture.componentInstance;
            const before = component.playback.videoVolume(); // starts at 1 (jsdom default)

            pressKey('ArrowDown'); // room to go down; up would clamp at the ceiling

            expect(component.panes.panelVisible()).toBe(false);
            expect(component.playback.videoVolume()).toBeLessThan(before);
            expect(component.playback.hudKind()).toBe('volume');
            expect(component.playback.hudVisible()).toBe(true);
        });

        it('Right is a deliberate no-op while immersive', async () => {
            const fixture = await createImmersiveFixture();
            const component = fixture.componentInstance;

            pressKey('ArrowRight');

            expect(component.panes.panelVisible()).toBe(false);
            expect(component.playback.hudVisible()).toBe(false);
        });

        it('Enter toggles play/pause instead of activating a channel', async () => {
            const fixture = await createImmersiveFixture();
            const component = fixture.componentInstance;

            pressKey('Enter');

            expect(component.panes.panelVisible()).toBe(false);
            expect(component.playback.hudKind()).toBe('play-pause');
            expect(component.playback.hudVisible()).toBe(true);
        });
    });

    describe('immersive channel switching (PageUp/PageDown while immersive)', () => {
        // activeChannelId updates synchronously (playChannel sets it before
        // any await), so no fake timers/whenStable() are needed here — and
        // deliberately not used: a second fixture.whenStable() call while
        // fake timers are active hangs (Angular's zoneless stability check
        // appears to depend on a real timer fake timers then never fire).

        it('PageDown switches to the next channel without revealing the panel', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;
            pressKey('Enter'); // activates sports-1, collapses to immersive
            expect(component.activeChannelId()).toBe('sports-1');
            expect(component.panes.panelVisible()).toBe(false);

            pressKey('PageDown');

            expect(component.activeChannelId()).toBe('sports-2');
            expect(component.panes.panelVisible()).toBe(false);
            expect(component.panes.channelsController.focusedIndex()).toBe(1);
        });

        it('PageUp switches to the previous channel', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;
            pressKey('ArrowDown'); // focus sports-2
            pressKey('Enter'); // activate sports-2, collapses to immersive
            expect(component.activeChannelId()).toBe('sports-2');

            pressKey('PageUp');

            expect(component.activeChannelId()).toBe('sports-1');
        });

        it('no-ops at the last channel instead of wrapping', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;
            pressKey('ArrowDown'); // focus news-1, the last of the 3 "all" channels
            pressKey('ArrowDown');
            pressKey('Enter');
            expect(component.activeChannelId()).toBe('news-1');

            pressKey('PageDown');

            expect(component.activeChannelId()).toBe('news-1');
        });

        it('works identically in grid mode', async () => {
            await settingsStore.updateSettings({ tvBrowseMode: 'grid' });
            const fixture = await createFixture();
            const component = fixture.componentInstance;
            pressKey('Enter'); // activates sports-1, collapses to immersive
            expect(component.activeChannelId()).toBe('sports-1');

            pressKey('PageDown');

            expect(component.activeChannelId()).toBe('sports-2');
        });
    });

    describe('source-switcher pane (toggleSources)', () => {
        it('opens the sources pane focused on the active playlist', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;

            pressKey('Tab');

            expect(component.panes.activePane()).toBe('sources');
            expect(component.panes.sourcesController.focusedIndex()).toBe(0);
            expect(component.sources()).toEqual(SOURCES);
        });

        it('a second toggleSources press returns to the pane it was opened from', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;

            pressKey('ArrowUp'); // -> pills pane
            pressKey('Tab'); // -> sources
            pressKey('Tab'); // back to pills

            expect(component.panes.activePane()).toBe('pills');
        });

        it('Escape from the sources pane returns to the previous pane, not immersive', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;

            pressKey('Tab');
            pressKey('Escape');

            expect(component.panes.activePane()).toBe('channels');
            expect(component.panes.panelVisible()).toBe(true);
        });

        it('selecting a different source switches catalog and lands on its first category', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;

            pressKey('Tab'); // -> sources, focused on Primary (index 0)
            pressKey('ArrowDown'); // -> Secondary
            pressKey('Enter');
            // selectSource() awaits catalog.selectPlaylist() before choosing
            // the new source's first category — let that microtask settle.
            await fixture.whenStable();

            expect(catalog.selectPlaylist).toHaveBeenCalledWith('p2');
            expect(component.panes.activePane()).toBe('channels');
            expect(component.categories()).toEqual(SECONDARY_CATEGORIES);
            expect(component.channels().map((c) => c.id)).toEqual([
                'other-1',
            ]);
        });

        it('gamepad Back/Select (button 8) toggles the sources pane the same as Tab', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;
            const gamepad = TestBed.inject(
                GamepadInputService
            ) as unknown as FakeGamepadInputService;

            gamepad.actionsSubject.next({ kind: 'toggleSources' });

            expect(component.panes.activePane()).toBe('sources');
        });
    });

    describe('channel info overlay (toggleInfo)', () => {
        beforeEach(() => jest.useFakeTimers());
        afterEach(() => jest.useRealTimers());

        it('shows info for the focused channel while the channels pane is open', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;

            pressKey('i', 'KeyI');

            expect(component.infoOverlayVisible()).toBe(true);
            expect(component.infoOverlayChannel()?.id).toBe('sports-1');
        });

        it('does nothing when there is no channel to describe', async () => {
            catalog.channels = () => [];
            const fixture = await createFixture();
            const component = fixture.componentInstance;

            pressKey('i', 'KeyI');

            expect(component.infoOverlayVisible()).toBe(false);
        });

        it('activating a channel shows its info overlay automatically', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;

            pressKey('Enter'); // activates sports-1, collapses to immersive

            expect(component.panes.panelVisible()).toBe(false);
            expect(component.infoOverlayVisible()).toBe(true);
            expect(component.infoOverlayChannel()?.id).toBe('sports-1');
        });

        it('auto-dismisses the activation overlay after its timeout', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;

            pressKey('Enter');
            expect(component.infoOverlayVisible()).toBe(true);

            jest.advanceTimersByTime(6000);

            expect(component.infoOverlayVisible()).toBe(false);
        });

        it('shows info for the actively playing channel while immersive', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;

            pressKey('Enter'); // activates sports-1, collapses to immersive
            expect(component.panes.panelVisible()).toBe(false);

            pressKey('i', 'KeyI');

            expect(component.infoOverlayVisible()).toBe(true);
            expect(component.infoOverlayChannel()?.id).toBe('sports-1');
        });

        it('does not reveal the panel while immersive', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;
            pressKey('Enter');
            expect(component.panes.panelVisible()).toBe(false);

            pressKey('i', 'KeyI');

            expect(component.panes.panelVisible()).toBe(false);
        });

        it('auto-dismisses after its timeout', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;

            pressKey('i', 'KeyI');
            expect(component.infoOverlayVisible()).toBe(true);

            jest.advanceTimersByTime(6000);

            expect(component.infoOverlayVisible()).toBe(false);
        });

        it('dismisses early on a direction press', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;
            pressKey('i', 'KeyI');
            expect(component.infoOverlayVisible()).toBe(true);

            pressKey('ArrowDown');

            expect(component.infoOverlayVisible()).toBe(false);
        });

        it('dismisses early on Escape', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;
            pressKey('i', 'KeyI');
            expect(component.infoOverlayVisible()).toBe(true);

            pressKey('Escape');

            expect(component.infoOverlayVisible()).toBe(false);
        });
    });

    describe('settings panel (openSettings)', () => {
        it('opens on keyboard S, focused on the first row', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;

            pressKey('s', 'KeyS');

            expect(component.panes.activePane()).toBe('settings');
            expect(component.panes.settingsController.focusedIndex()).toBe(0);
        });

        it('opens on gamepad Start (openSettings action)', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;
            const gamepad = TestBed.inject(
                GamepadInputService
            ) as unknown as FakeGamepadInputService;

            gamepad.actionsSubject.next({ kind: 'openSettings' });

            expect(component.panes.activePane()).toBe('settings');
        });

        it('a second toggle press returns to the pane it was opened from', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;

            pressKey('ArrowUp'); // -> pills pane
            pressKey('s', 'KeyS'); // -> settings
            pressKey('s', 'KeyS'); // back to pills

            expect(component.panes.activePane()).toBe('pills');
        });

        it('Escape returns to the pane it was opened from, not immersive', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;

            pressKey('ArrowUp'); // -> pills pane
            pressKey('s', 'KeyS'); // -> settings
            pressKey('Escape');

            expect(component.panes.activePane()).toBe('pills');
            expect(component.panes.panelVisible()).toBe(true);
        });

        it('Up/Down moves focus across the settings rows', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;

            pressKey('s', 'KeyS');
            pressKey('ArrowDown');
            expect(component.panes.settingsController.focusedIndex()).toBe(1);

            pressKey('ArrowUp');
            expect(component.panes.settingsController.focusedIndex()).toBe(0);
        });

        it('Right cycles the focused enum row forward and saves immediately', async () => {
            await createFixture();
            pressKey('s', 'KeyS'); // row 0: language, ENGLISH

            pressKey('ArrowRight');

            expect(settingsStore.updateSettings).toHaveBeenCalledWith({
                language: Language.KOREAN,
            });
        });

        it('Left cycles the focused enum row backward', async () => {
            await createFixture();
            pressKey('s', 'KeyS'); // row 0: language, ENGLISH

            pressKey('ArrowLeft');

            expect(settingsStore.updateSettings).toHaveBeenCalledWith({
                language: Language.MOROCCAN_ARABIC,
            });
        });

        it('Right flips a toggle row', async () => {
            await createFixture();
            pressKey('s', 'KeyS');
            pressKey('ArrowDown'); // theme
            pressKey('ArrowDown'); // showCaptions

            pressKey('ArrowRight');

            expect(settingsStore.updateSettings).toHaveBeenCalledWith({
                showCaptions: true,
            });
        });

        it('Right steps a numeric row and Left clamps it at its floor', async () => {
            await createFixture();
            pressKey('s', 'KeyS');
            for (let i = 0; i < 5; i++) {
                pressKey('ArrowDown'); // -> tvIdleTimeoutSeconds (row 5)
            }

            pressKey('ArrowRight');
            expect(settingsStore.updateSettings).toHaveBeenCalledWith({
                tvIdleTimeoutSeconds: 10,
            });

            pressKey('ArrowLeft');
            pressKey('ArrowLeft');
            pressKey('ArrowLeft');
            expect(settingsStore.updateSettings).toHaveBeenLastCalledWith({
                tvIdleTimeoutSeconds: 3,
            });
        });

        it('does not fall through to channel/category navigation while open', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;
            pressKey('s', 'KeyS');

            pressKey('Enter'); // would otherwise activate/play a channel

            expect(component.panes.activePane()).toBe('settings');
            expect(component.activeChannelId()).toBeNull();
        });

        describe('idle timeout reads from settings', () => {
            beforeEach(() => jest.useFakeTimers());
            afterEach(() => jest.useRealTimers());

            it('uses the configured tvIdleTimeoutSeconds instead of a hardcoded 5s default', async () => {
                const fixture = await createFixture();
                const component = fixture.componentInstance;

                await settingsStore.updateSettings({ tvIdleTimeoutSeconds: 1 });
                pressKey('ArrowDown'); // wake() -> resetIdleTimer() reads the new value

                jest.advanceTimersByTime(1000);

                expect(component.panes.panelVisible()).toBe(false);
            });
        });

        it('Right on the Channel view row cycles list to grid and saves immediately', async () => {
            await createFixture();
            pressKey('s', 'KeyS');
            for (let i = 0; i < 6; i++) {
                pressKey('ArrowDown'); // -> tvBrowseMode (row 6)
            }

            pressKey('ArrowRight');

            expect(settingsStore.updateSettings).toHaveBeenCalledWith({
                tvBrowseMode: 'grid',
            });
        });
    });

    describe('captions (Settings.showCaptions)', () => {
        it('applies the initial setting once the video element attaches', async () => {
            await settingsStore.updateSettings({ showCaptions: true });
            const setCaptionsEnabledSpy = jest.spyOn(
                TvPlaybackController.prototype,
                'setCaptionsEnabled'
            );

            await createFixture();

            expect(setCaptionsEnabledSpy).toHaveBeenCalledWith(true);
            setCaptionsEnabledSpy.mockRestore();
        });

        it('applies a live settings change without reloading the stream', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;
            const setCaptionsEnabledSpy = jest.spyOn(
                component.playback,
                'setCaptionsEnabled'
            );

            await settingsStore.updateSettings({ showCaptions: true });
            fixture.detectChanges();

            expect(setCaptionsEnabledSpy).toHaveBeenCalledWith(true);
        });
    });

    describe('numeric channel entry', () => {
        beforeEach(() => jest.useFakeTimers());
        afterEach(() => jest.useRealTimers());

        it('jumps within the current category by real channel number, without switching category', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;
            component.panes.selectCategory(1); // 'sports'

            pressKey('1');
            pressKey('0');
            pressKey('2');
            jest.advanceTimersByTime(1750);

            expect(component.panes.selectedCategoryId()).toBe('sports');
            expect(component.activeChannelId()).toBe('sports-2');
        });

        it('switches category first when the target channel lives elsewhere', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;
            // Starts on category 0 ('all'); narrow to 'sports' first so the
            // jump to a 'news' channel actually has to switch category.
            component.panes.selectCategory(1);
            expect(component.panes.selectedCategoryId()).toBe('sports');

            pressKey('3');
            pressKey('0');
            pressKey('1');
            jest.advanceTimersByTime(1750);

            expect(component.panes.selectedCategoryId()).toBe('news');
            expect(component.activeChannelId()).toBe('news-1');
            expect(component.panes.panelVisible()).toBe(false); // collapsed to immersive, like any other activation
        });

        it('does nothing when no channel matches the typed number', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;

            pressKey('9');
            pressKey('9');
            pressKey('9');
            jest.advanceTimersByTime(1750);

            expect(component.activeChannelId()).toBeNull();
        });

        it('shows the typed digits in the overlay until they commit', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;

            pressKey('1');
            pressKey('0');
            expect(component.digitEntry.digits()).toBe('10');

            jest.advanceTimersByTime(1750);
            expect(component.digitEntry.digits()).toBe('');
        });
    });

    describe('Recently Viewed pane', () => {
        it('records a confirmed activation and lists it once opened', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;
            pressKey('Enter'); // activates sports-1 -> recorded as recent, collapses to immersive
            await fixture.whenStable(); // let activateChannel()'s awaited playNow()/recordRecentlyViewed() settle
            pressKey('v', 'KeyV'); // first press just wakes (panel was immersive)

            pressKey('v', 'KeyV'); // second press opens the pane

            expect(component.panes.activePane()).toBe('recent');
            expect(component.recentChannels().map((c) => c.id)).toEqual([
                'sports-1',
            ]);
        });

        it('closes back to the previous pane on a second press', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;

            pressKey('v', 'KeyV');
            expect(component.panes.activePane()).toBe('recent');

            pressKey('v', 'KeyV');
            expect(component.panes.activePane()).toBe('channels');
        });

        it('a first press while immersive only wakes the panel, matching onToggleSources', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;
            pressKey('Enter'); // activates and collapses to immersive
            expect(component.panes.panelVisible()).toBe(false);

            pressKey('v', 'KeyV');

            expect(component.panes.panelVisible()).toBe(true);
            expect(component.panes.activePane()).toBe('channels');
        });

        it('activating a recent row plays that channel, switching category if needed', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;
            pressKey('ArrowDown'); // focus sports-2
            pressKey('Enter'); // activate it -> recorded as recent, collapses to immersive
            await fixture.whenStable(); // let recordRecentlyViewed() settle before opening the pane
            pressKey('v', 'KeyV'); // wake
            pressKey('v', 'KeyV'); // open Recently Viewed

            pressKey('Enter'); // activate the only recent row (sports-2)

            expect(component.activeChannelId()).toBe('sports-2');
            expect(component.panes.panelVisible()).toBe(false);
        });

        it('shows an empty state until anything has been watched', async () => {
            const fixture = await createFixture();

            pressKey('v', 'KeyV');
            fixture.detectChanges();

            expect(
                fixture.nativeElement.querySelector('.tv-recent-panel__empty')
            ).not.toBeNull();
        });
    });

    describe('Recording', () => {
        it('starts a recording for the active channel and shows the indicator', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;
            pressKey('Enter'); // activate sports-1
            await fixture.whenStable();

            pressKey('r', 'KeyR');
            await fixture.whenStable();
            fixture.detectChanges();

            expect(recordingsService.startTvRecording).toHaveBeenCalledWith(
                expect.objectContaining({
                    metadata: expect.objectContaining({
                        channelName: 'Channel sports-1',
                    }),
                    streamUrl: 'https://stream.test',
                })
            );
            expect(component.recording.activeRecording()?.status).toBe(
                'recording'
            );
            expect(
                fixture.nativeElement.querySelector(
                    '.tv-recording-indicator'
                )
            ).not.toBeNull();
        });

        it('stops the active recording on a second press instead of starting another', async () => {
            const fixture = await createFixture();
            pressKey('Enter');
            await fixture.whenStable();
            pressKey('r', 'KeyR');
            await fixture.whenStable();

            pressKey('r', 'KeyR');
            await fixture.whenStable();

            expect(recordingsService.stopRecording).toHaveBeenCalledWith(1);
            expect(recordingsService.startTvRecording).toHaveBeenCalledTimes(
                1
            );
        });

        it('does nothing when nothing is playing', async () => {
            await createFixture();

            pressKey('r', 'KeyR');
            await Promise.resolve();

            expect(recordingsService.startTvRecording).not.toHaveBeenCalled();
        });

        it('opens the recordings pane with KeyL and plays a completed recording', async () => {
            recordingsService.recordings.set([
                {
                    id: 5,
                    status: 'completed',
                    filePath: '/downloads/rec5.ts',
                    channelName: 'Old Recording',
                    startedAt: '2026-09-27T10:00:00Z',
                    fileAvailability: 'available',
                },
            ]);
            const fixture = await createFixture();
            const component = fixture.componentInstance;
            const playRecordingSpy = jest.spyOn(
                component.playback,
                'playRecording'
            );

            pressKey('l', 'KeyL');
            expect(component.panes.activePane()).toBe('recordings');

            pressKey('Enter');

            expect(playRecordingSpy).toHaveBeenCalledWith('/downloads/rec5.ts');
            expect(component.activeChannelId()).toBeNull();
            expect(component.panes.panelVisible()).toBe(false);
        });
    });

    describe('EPG Guide (KeyG)', () => {
        it('opens the guide focused on the active channel and renders every channel row', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;
            pressKey('Enter'); // activate sports-1
            await fixture.whenStable();
            pressKey('g', 'KeyG'); // first press just wakes (immersive)

            pressKey('g', 'KeyG'); // second press opens the guide
            fixture.detectChanges();

            expect(component.panes.activePane()).toBe('guide');
            expect(component.epgGuide.focus.focus()).toEqual({
                row: 0,
                block: null,
            });
            expect(
                fixture.nativeElement.querySelectorAll('app-tv-epg-guide-row')
                    .length
            ).toBe(ALL_CHANNELS.length);
        });

        it('narrows the guide to the currently selected category, not the whole source', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;
            component.panes.selectCategory(1); // 'sports'

            pressKey('g', 'KeyG');
            fixture.detectChanges();

            expect(component.epgGuide.channels().map((c) => c.id)).toEqual([
                'sports-1',
                'sports-2',
            ]);
            expect(
                fixture.nativeElement.querySelectorAll('app-tv-epg-guide-row')
                    .length
            ).toBe(SPORTS_CHANNELS.length);
            expect(
                fixture.nativeElement
                    .querySelector('.tv-epg-guide-grid__title')
                    .textContent.trim()
            ).toBe('Guide · Sports');
        });

        it('closes back to the previous pane on a second press', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;

            pressKey('g', 'KeyG');
            expect(component.panes.activePane()).toBe('guide');

            pressKey('g', 'KeyG');
            expect(component.panes.activePane()).toBe('channels');
        });

        it('carries the row the guide was left on into the channel list focus', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;
            pressKey('g', 'KeyG');
            pressKey('ArrowDown'); // focus sports-2 in the guide

            pressKey('g', 'KeyG'); // close back out

            expect(component.panes.activePane()).toBe('channels');
            expect(component.panes.channelsController.focusedIndex()).toBe(
                ALL_CHANNELS.findIndex((c) => c.id === 'sports-2')
            );
        });

        it('carries continuity through Escape too, scoped to the open category', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;
            component.panes.selectCategory(1); // 'sports'
            pressKey('g', 'KeyG');
            pressKey('ArrowDown'); // focus sports-2 in the guide

            pressKey('Escape');

            expect(component.panes.channelsController.focusedIndex()).toBe(
                SPORTS_CHANNELS.findIndex((c) => c.id === 'sports-2')
            );
        });

        it('Up/Down moves the guide focus between channel rows', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;
            pressKey('g', 'KeyG');

            pressKey('ArrowDown');

            expect(component.epgGuide.focus.focus()?.row).toBe(1);
        });

        it('activating a focused row plays that channel, switching category if needed', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;
            pressKey('g', 'KeyG');
            pressKey('ArrowDown'); // focus sports-2

            pressKey('Enter');
            await fixture.whenStable();

            expect(component.activeChannelId()).toBe('sports-2');
            expect(component.panes.panelVisible()).toBe(false);
        });

        it('PageUp/PageDown step the guide day instead of the category while open', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;
            pressKey('g', 'KeyG');
            const today = component.epgGuide.dateKey();

            pressKey('PageDown');

            expect(component.epgGuide.dateKey()).not.toBe(today);
            expect(component.panes.selectedCategoryId()).toBe('all');
        });

        it('Escape closes the guide back to the previous pane', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;
            component.panes.activePane.set('pills');
            pressKey('g', 'KeyG');
            expect(component.panes.activePane()).toBe('guide');

            pressKey('Escape');

            expect(component.panes.activePane()).toBe('pills');
        });
    });

    describe('grid browse mode (Settings.tvBrowseMode)', () => {
        it('renders the channel list by default', async () => {
            const fixture = await createFixture();

            expect(
                fixture.nativeElement.querySelector('app-tv-channel-list')
            ).not.toBeNull();
            expect(
                fixture.nativeElement.querySelector('app-tv-channel-grid')
            ).toBeNull();
        });

        it('renders the channel grid and a side category list when set to grid', async () => {
            await settingsStore.updateSettings({ tvBrowseMode: 'grid' });
            const fixture = await createFixture();

            expect(
                fixture.nativeElement.querySelector('app-tv-channel-grid')
            ).not.toBeNull();
            expect(
                fixture.nativeElement.querySelector('app-tv-channel-list')
            ).toBeNull();
            expect(
                fixture.nativeElement.querySelector('app-tv-category-list')
            ).not.toBeNull();
            expect(
                fixture.nativeElement.querySelector('app-tv-category-pills')
            ).toBeNull();
        });

        it('Right from the category list enters the grid; Up/Down move within the category list', async () => {
            await settingsStore.updateSettings({ tvBrowseMode: 'grid' });
            const fixture = await createFixture();
            const component = fixture.componentInstance;

            pressKey('ArrowLeft'); // channels -> pills (leftmost column, only column)
            expect(component.panes.activePane()).toBe('pills');

            pressKey('ArrowDown'); // moves within the vertical category list
            expect(component.panes.pillsController.focusedIndex()).toBe(1);

            pressKey('ArrowRight'); // -> back into the grid

            expect(component.panes.activePane()).toBe('channels');
        });

        it('widens the panel only while the pills+channel view is showing', async () => {
            await settingsStore.updateSettings({ tvBrowseMode: 'grid' });
            const fixture = await createFixture();
            const panelEl = () =>
                fixture.nativeElement.querySelector('.tv-live-screen__panel');

            expect(panelEl().classList).toContain(
                'tv-live-screen__panel--grid'
            );

            pressKey('Tab'); // -> sources pane
            fixture.detectChanges();

            expect(panelEl().classList).not.toContain(
                'tv-live-screen__panel--grid'
            );
        });

        it('moves focus in 2D across rows, including a ragged last row', async () => {
            // 10 channels over 6 columns: a full first row (0-5) and a
            // ragged second row (6-9, only 4 of 6 columns filled).
            catalog.channels = () =>
                Array.from({ length: 10 }, (_, i) => channel(`g${i}`, 'all'));
            await settingsStore.updateSettings({ tvBrowseMode: 'grid' });
            const fixture = await createFixture();
            const component = fixture.componentInstance;
            const focusedIndex = () =>
                component.panes.channelsController.focusedIndex();

            expect(focusedIndex()).toBe(0);

            pressKey('ArrowDown'); // 0 -> 6
            expect(focusedIndex()).toBe(6);

            pressKey('ArrowRight');
            pressKey('ArrowRight');
            pressKey('ArrowRight'); // 6 -> 7 -> 8 -> 9
            expect(focusedIndex()).toBe(9);

            pressKey('ArrowRight'); // no-op: index 10 doesn't exist
            expect(focusedIndex()).toBe(9);

            pressKey('ArrowUp'); // 9 -> 3
            expect(focusedIndex()).toBe(3);
        });

        it('hands off to the pills pane on Left from the leftmost column, at any row', async () => {
            catalog.channels = () =>
                Array.from({ length: 10 }, (_, i) => channel(`g${i}`, 'all'));
            await settingsStore.updateSettings({ tvBrowseMode: 'grid' });
            const fixture = await createFixture();
            const component = fixture.componentInstance;

            pressKey('ArrowDown'); // -> index 6, leftmost column of the second row
            expect(component.panes.channelsController.focusedIndex()).toBe(6);

            pressKey('ArrowLeft');

            expect(component.panes.activePane()).toBe('pills');
        });

        it('Up within the grid moves rows and never hands off, unlike list mode', async () => {
            catalog.channels = () =>
                Array.from({ length: 10 }, (_, i) => channel(`g${i}`, 'all'));
            await settingsStore.updateSettings({ tvBrowseMode: 'grid' });
            const fixture = await createFixture();
            const component = fixture.componentInstance;

            pressKey('ArrowUp'); // already first row: no-op, stays on channels

            expect(component.panes.activePane()).toBe('channels');
            expect(component.panes.channelsController.focusedIndex()).toBe(0);
        });

        it('activating a tile plays it exactly like list mode', async () => {
            await settingsStore.updateSettings({ tvBrowseMode: 'grid' });
            const fixture = await createFixture();
            const component = fixture.componentInstance;

            pressKey('Enter');

            expect(component.activeChannelId()).toBe('sports-1');
            expect(component.panes.panelVisible()).toBe(false);
        });
    });

    describe('Dashboard navigation', () => {
        it('navigates to /dashboard on gamepad right-stick click', async () => {
            await createFixture();
            const navigateByUrl = jest
                .spyOn(TestBed.inject(Router), 'navigateByUrl')
                .mockResolvedValue(true);
            const gamepad = TestBed.inject(
                GamepadInputService
            ) as unknown as FakeGamepadInputService;

            gamepad.actionsSubject.next({ kind: 'openDashboard' });

            expect(navigateByUrl).toHaveBeenCalledWith('/dashboard');
        });

        it('navigates to /dashboard on keyboard H', async () => {
            await createFixture();
            const navigateByUrl = jest
                .spyOn(TestBed.inject(Router), 'navigateByUrl')
                .mockResolvedValue(true);

            pressKey('h', 'KeyH');

            expect(navigateByUrl).toHaveBeenCalledWith('/dashboard');
        });

        it.each([
            ['sources', 'sources'],
            ['recent', 'recent'],
            ['recordings', 'recordings'],
            ['settings', 'settings'],
        ] as const)(
            'opens the %s pane when requested by the Dashboard before construction',
            async (pane, expectedPane) => {
                TestBed.inject(TvPendingPaneService).request(pane);

                const fixture = await createFixture();

                expect(fixture.componentInstance.panes.activePane()).toBe(
                    expectedPane
                );
            }
        );

        it('opens no pane when nothing was requested', async () => {
            const fixture = await createFixture();

            expect(fixture.componentInstance.panes.activePane()).toBe(
                'channels'
            );
        });
    });
});
