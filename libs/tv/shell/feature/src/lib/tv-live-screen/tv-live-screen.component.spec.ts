import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { GamepadInputService, TvLiveCatalogFacade } from '@iptvnator/tv/data-access';
import type {
    TvGamepadAction,
    TvLiveCategory,
    TvLiveChannel,
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

class FakeTvLiveCatalogFacade {
    readonly status = signal<'loading' | 'ready' | 'no-playlists' | 'error'>(
        'loading'
    );
    readonly playlistTitle = signal<string | null>(null);
    private readonly selectedCategoryId = signal('all');

    readonly initialize = jest.fn(async () => {
        this.status.set('ready');
        this.playlistTitle.set('Test Playlist');
    });
    readonly resolvePlayback = jest
        .fn()
        .mockResolvedValue({ streamUrl: 'https://stream.test' });

    categories(): TvLiveCategory[] {
        return CATEGORIES;
    }

    selectCategory(categoryId: string): void {
        this.selectedCategoryId.set(categoryId);
    }

    channels(): TvLiveChannel[] {
        return CHANNELS_BY_CATEGORY[this.selectedCategoryId()] ?? [];
    }
}

class FakeGamepadInputService {
    readonly actionsSubject = new Subject<TvGamepadAction>();
    readonly actions$ = this.actionsSubject.asObservable();
}

function pressKey(key: string): void {
    document.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
    );
}

describe('TvLiveScreenComponent', () => {
    let catalog: FakeTvLiveCatalogFacade;

    beforeEach(() => {
        catalog = new FakeTvLiveCatalogFacade();
        TestBed.configureTestingModule({
            imports: [TvLiveScreenComponent],
            providers: [
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

        it('any input redisplays the panel without also performing that input', async () => {
            const fixture = await createFixture();
            const component = fixture.componentInstance;
            jest.advanceTimersByTime(5000);
            expect(component.panelVisible()).toBe(false);

            pressKey('ArrowDown');

            expect(component.panelVisible()).toBe(true);
            expect(component.channelsController.focusedIndex()).toBe(0);
        });
    });
});
