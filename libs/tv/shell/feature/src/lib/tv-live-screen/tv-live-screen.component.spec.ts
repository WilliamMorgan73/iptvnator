import { TestBed } from '@angular/core/testing';
import { TvLiveScreenComponent } from './tv-live-screen.component';

function pressKey(key: string): void {
    document.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
    );
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
