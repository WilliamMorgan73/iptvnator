import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { GamepadInputService } from '@iptvnator/tv/data-access';
import type { TvGamepadAction } from '@iptvnator/tv/util';
import { TvLiveScreenComponent } from './tv-live-screen.component';

function pressKey(key: string): void {
    document.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
    );
}

class FakeGamepadInputService {
    readonly actionsSubject = new Subject<TvGamepadAction>();
    readonly actions$ = this.actionsSubject.asObservable();
}

describe('TvLiveScreenComponent', () => {
    function createFixture() {
        const fixture = TestBed.createComponent(TvLiveScreenComponent);
        fixture.detectChanges();
        return fixture;
    }

    beforeEach(() => {
        TestBed.configureTestingModule({ imports: [TvLiveScreenComponent] });
    });

    it('starts on Sports with the first channel focused and the panel visible', () => {
        const fixture = createFixture();
        const component = fixture.componentInstance;
        expect(component.selectedCategoryId()).toBe('sports');
        expect(component.channelsController.focusedIndex()).toBe(0);
        expect(component.panelVisible()).toBe(true);
        expect(component.activePane()).toBe('channels');
    });

    it('moves the channel focus down and up within the channels pane', () => {
        const fixture = createFixture();
        const component = fixture.componentInstance;

        pressKey('ArrowDown');
        expect(component.channelsController.focusedIndex()).toBe(1);

        pressKey('ArrowUp');
        expect(component.channelsController.focusedIndex()).toBe(0);
    });

    it('hands off to the pills pane on up from the topmost channel row', () => {
        const fixture = createFixture();
        const component = fixture.componentInstance;

        expect(component.channelsController.focusedIndex()).toBe(0);
        pressKey('ArrowUp');
        expect(component.activePane()).toBe('pills');
        expect(component.channelsController.focusedIndex()).toBe(0); // untouched
    });

    it('hands off back to the channels pane on down from the pills', () => {
        const fixture = createFixture();
        const component = fixture.componentInstance;

        pressKey('ArrowUp'); // channels -> pills
        expect(component.activePane()).toBe('pills');
        pressKey('ArrowDown'); // pills -> channels
        expect(component.activePane()).toBe('channels');
    });

    it('moves the pill focus with left/right while the pills pane is active', () => {
        const fixture = createFixture();
        const component = fixture.componentInstance;

        pressKey('ArrowUp'); // enter pills pane, focused on Sports (index 1)
        expect(component.pillsController.focusedIndex()).toBe(1);
        pressKey('ArrowRight');
        expect(component.pillsController.focusedIndex()).toBe(2); // News
        pressKey('ArrowLeft');
        expect(component.pillsController.focusedIndex()).toBe(1); // back to Sports
    });

    it('selecting a pill switches category and returns focus to the channel list', () => {
        const fixture = createFixture();
        const component = fixture.componentInstance;

        pressKey('ArrowUp'); // -> pills, focused Sports
        pressKey('ArrowRight'); // -> News
        pressKey('Enter');

        expect(component.selectedCategoryId()).toBe('news');
        expect(component.activePane()).toBe('channels');
        expect(component.channelsController.focusedIndex()).toBe(0);
    });

    it('activating a channel marks it active and collapses to immersive', () => {
        const fixture = createFixture();
        const component = fixture.componentInstance;

        pressKey('Enter');

        expect(component.activeChannelId()).toBe(component.channels()[0].id);
        expect(component.panelVisible()).toBe(false);
    });

    it('Escape collapses the panel to immersive', () => {
        const fixture = createFixture();
        const component = fixture.componentInstance;

        pressKey('Escape');
        expect(component.panelVisible()).toBe(false);
    });

    describe('categoryStep (gamepad LB/RB, keyboard PageUp/PageDown)', () => {
        it('steps to the next category and selects it', () => {
            const fixture = createFixture();
            const component = fixture.componentInstance;

            pressKey('PageDown'); // Sports -> News

            expect(component.selectedCategoryId()).toBe('news');
            expect(component.pillsController.focusedIndex()).toBe(2);
            expect(component.activePane()).toBe('channels');
            expect(component.channelsController.focusedIndex()).toBe(0);
        });

        it('steps to the previous category and selects it', () => {
            const fixture = createFixture();
            const component = fixture.componentInstance;

            pressKey('PageUp'); // Sports -> All

            expect(component.selectedCategoryId()).toBe('all');
        });

        it('no-ops past the first and last category', () => {
            const fixture = createFixture();
            const component = fixture.componentInstance;

            pressKey('PageUp'); // -> All (index 0)
            pressKey('PageUp'); // no-op, already first
            expect(component.selectedCategoryId()).toBe('all');

            pressKey('PageDown'); // -> Sports
            pressKey('PageDown'); // -> News
            pressKey('PageDown'); // -> Movies (index 3, last)
            pressKey('PageDown'); // no-op, already last
            expect(component.selectedCategoryId()).toBe('movies');
        });
    });

    describe('gamepad input', () => {
        beforeEach(() => {
            TestBed.overrideProvider(GamepadInputService, {
                useClass: FakeGamepadInputService,
            });
        });

        function gamepadService(): FakeGamepadInputService {
            return TestBed.inject(
                GamepadInputService
            ) as unknown as FakeGamepadInputService;
        }

        it('drives channel focus from a direction action', () => {
            const fixture = createFixture();
            const component = fixture.componentInstance;

            gamepadService().actionsSubject.next({
                kind: 'direction',
                direction: 'down',
            });

            expect(component.channelsController.focusedIndex()).toBe(1);
        });

        it('drives category selection from a categoryStep action', () => {
            const fixture = createFixture();
            const component = fixture.componentInstance;

            gamepadService().actionsSubject.next({
                kind: 'categoryStep',
                direction: 'next',
            });

            expect(component.selectedCategoryId()).toBe('news');
        });

        it('drives activate/back from gamepad A/B', () => {
            const fixture = createFixture();
            const component = fixture.componentInstance;
            const service = gamepadService();

            service.actionsSubject.next({ kind: 'activate' });
            expect(component.activeChannelId()).toBe(component.channels()[0].id);
            expect(component.panelVisible()).toBe(false);

            service.actionsSubject.next({ kind: 'back' });
            expect(component.panelVisible()).toBe(true); // wake-only after collapse
        });
    });

    describe('idle auto-hide', () => {
        beforeEach(() => jest.useFakeTimers());
        afterEach(() => jest.useRealTimers());

        it('collapses to immersive after 5s of no input', () => {
            const fixture = createFixture();
            const component = fixture.componentInstance;

            jest.advanceTimersByTime(5000);
            expect(component.panelVisible()).toBe(false);
        });

        it('any input redisplays the panel without also performing that input', () => {
            const fixture = createFixture();
            const component = fixture.componentInstance;
            jest.advanceTimersByTime(5000);
            expect(component.panelVisible()).toBe(false);

            pressKey('ArrowDown');

            expect(component.panelVisible()).toBe(true);
            expect(component.channelsController.focusedIndex()).toBe(0); // unmoved
        });

        it('resets the idle timer on every input', () => {
            const fixture = createFixture();
            const component = fixture.componentInstance;

            jest.advanceTimersByTime(4000);
            pressKey('ArrowDown'); // resets the timer; panel already visible so this one also moves focus
            jest.advanceTimersByTime(4000);
            expect(component.panelVisible()).toBe(true);
            jest.advanceTimersByTime(1000);
            expect(component.panelVisible()).toBe(false);
        });
    });
});
