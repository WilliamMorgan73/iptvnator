import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { GamepadInputService, TvLiveCatalogFacade } from '@iptvnator/tv/data-access';
import type {
    TvGamepadAction,
    TvLiveCategory,
    TvLiveChannel,
    TvLiveSource,
} from '@iptvnator/tv/util';
import { TvLiveScreenComponent } from './tv-live-screen.component';

const CATEGORIES: TvLiveCategory[] = [
    { id: 'all', name: 'All' },
    { id: 'sports', name: 'Sports' },
    { id: 'news', name: 'News' },
    { id: 'movies', name: 'Movies' },
];

function channel(id: string, categoryId: string): TvLiveChannel {
    return {
        id,
        name: `Channel ${id}`,
        categoryId,
        sourceKind: 'xtream',
        playRef: null,
    };
}

const SPORTS_CHANNELS = [
    channel('sports-1', 'sports'),
    channel('sports-2', 'sports'),
];
const NEWS_CHANNELS = [channel('news-1', 'news')];
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
}

class FakeGamepadInputService {
    readonly actionsSubject = new Subject<TvGamepadAction>();
    readonly actions$ = this.actionsSubject.asObservable();
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

    beforeEach(() => {
        catalog = new FakeTvLiveCatalogFacade();
        TestBed.configureTestingModule({
            imports: [TvLiveScreenComponent],
            providers: [
                provideRouter([]),
                { provide: TvLiveCatalogFacade, useValue: catalog },
                { provide: GamepadInputService, useClass: FakeGamepadInputService },
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
        expect(component.selectedCategoryId()).toBe('all');
        expect(component.channelsController.focusedIndex()).toBe(0);
        expect(component.panelVisible()).toBe(true);
        expect(component.activePane()).toBe('channels');
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
        expect(component.channelsController.focusedIndex()).toBe(1);

        pressKey('ArrowUp');
        expect(component.channelsController.focusedIndex()).toBe(0);
    });

    it('hands off to the pills pane on up from the topmost channel row', async () => {
        const fixture = await createFixture();
        const component = fixture.componentInstance;

        pressKey('ArrowUp');
        expect(component.activePane()).toBe('pills');
        expect(component.channelsController.focusedIndex()).toBe(0);
    });

    it('selecting a pill calls catalog.selectCategory and returns focus to channels', async () => {
        const fixture = await createFixture();
        const component = fixture.componentInstance;

        pressKey('ArrowUp'); // -> pills, focused All (index 0)
        pressKey('ArrowRight'); // -> Sports
        pressKey('Enter');

        expect(component.selectedCategoryId()).toBe('sports');
        expect(component.activePane()).toBe('channels');
        expect(component.channelsController.focusedIndex()).toBe(0);
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
        expect(component.panelVisible()).toBe(false);
    });

    it('Escape collapses the panel to immersive', async () => {
        const fixture = await createFixture();
        pressKey('Escape');
        expect(fixture.componentInstance.panelVisible()).toBe(false);
    });

    describe('categoryStep (gamepad LB/RB, keyboard PageUp/PageDown)', () => {
        it('steps to the next category and selects it', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;

            pressKey('PageDown'); // All -> Sports

            expect(component.selectedCategoryId()).toBe('sports');
            expect(component.pillsController.focusedIndex()).toBe(1);
        });

        it('no-ops past the first and last category', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;

            pressKey('PageUp'); // already first, no-op
            expect(component.selectedCategoryId()).toBe('all');

            pressKey('PageDown');
            pressKey('PageDown');
            pressKey('PageDown'); // -> Movies (last)
            pressKey('PageDown'); // no-op
            expect(component.selectedCategoryId()).toBe('movies');
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

            expect(component.channelsController.focusedIndex()).toBe(1);
        });
    });

    describe('idle auto-hide', () => {
        beforeEach(() => jest.useFakeTimers());
        afterEach(() => jest.useRealTimers());

        it('collapses to immersive after 5s of no input', async () => {
            const fixture = await createFixture();
            jest.advanceTimersByTime(5000);
            expect(fixture.componentInstance.panelVisible()).toBe(false);
        });

        it('Left redisplays the panel without also performing navigation', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;
            jest.advanceTimersByTime(5000);
            expect(component.panelVisible()).toBe(false);

            pressKey('ArrowLeft');

            expect(component.panelVisible()).toBe(true);
            expect(component.channelsController.focusedIndex()).toBe(0);
        });
    });

    describe('immersive playback controls', () => {
        beforeEach(() => jest.useFakeTimers());
        afterEach(() => jest.useRealTimers());

        async function createImmersiveFixture() {
            const fixture = await createFixture();
            fixture.componentInstance.onBack(); // panel -> immersive
            expect(fixture.componentInstance.panelVisible()).toBe(false);
            return fixture;
        }

        it('Up/Down adjust volume instead of navigating or revealing the panel', async () => {
            const fixture = await createImmersiveFixture();
            const component = fixture.componentInstance;
            const before = component.playback.videoVolume(); // starts at 1 (jsdom default)

            pressKey('ArrowDown'); // room to go down; up would clamp at the ceiling

            expect(component.panelVisible()).toBe(false);
            expect(component.playback.videoVolume()).toBeLessThan(before);
            expect(component.playback.hudKind()).toBe('volume');
            expect(component.playback.hudVisible()).toBe(true);
        });

        it('Right is a deliberate no-op while immersive', async () => {
            const fixture = await createImmersiveFixture();
            const component = fixture.componentInstance;

            pressKey('ArrowRight');

            expect(component.panelVisible()).toBe(false);
            expect(component.playback.hudVisible()).toBe(false);
        });

        it('Enter toggles play/pause instead of activating a channel', async () => {
            const fixture = await createImmersiveFixture();
            const component = fixture.componentInstance;

            pressKey('Enter');

            expect(component.panelVisible()).toBe(false);
            expect(component.playback.hudKind()).toBe('play-pause');
            expect(component.playback.hudVisible()).toBe(true);
        });
    });

    describe('source-switcher pane (toggleSources)', () => {
        it('opens the sources pane focused on the active playlist', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;

            pressKey('Tab');

            expect(component.activePane()).toBe('sources');
            expect(component.sourcesController.focusedIndex()).toBe(0);
            expect(component.sources()).toEqual(SOURCES);
        });

        it('a second toggleSources press returns to the pane it was opened from', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;

            pressKey('ArrowUp'); // -> pills pane
            pressKey('Tab'); // -> sources
            pressKey('Tab'); // back to pills

            expect(component.activePane()).toBe('pills');
        });

        it('Escape from the sources pane returns to the previous pane, not immersive', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;

            pressKey('Tab');
            pressKey('Escape');

            expect(component.activePane()).toBe('channels');
            expect(component.panelVisible()).toBe(true);
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
            expect(component.activePane()).toBe('channels');
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

            expect(component.activePane()).toBe('sources');
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

            expect(component.panelVisible()).toBe(false);
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
            expect(component.panelVisible()).toBe(false);

            pressKey('i', 'KeyI');

            expect(component.infoOverlayVisible()).toBe(true);
            expect(component.infoOverlayChannel()?.id).toBe('sports-1');
        });

        it('does not reveal the panel while immersive', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;
            pressKey('Enter');
            expect(component.panelVisible()).toBe(false);

            pressKey('i', 'KeyI');

            expect(component.panelVisible()).toBe(false);
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
});
