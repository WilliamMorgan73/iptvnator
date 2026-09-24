import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TvOnscreenKeyboardComponent } from './tv-onscreen-keyboard.component';

@Component({
    imports: [TvOnscreenKeyboardComponent],
    template: `<app-tv-onscreen-keyboard
        [currentValue]="currentValue()"
        [masked]="masked()"
        [shiftActive]="shiftActive()"
        [focusedIndex]="focusedIndex()"
    />`,
})
class HostComponent {
    // Real signals, not plain fields — this repo's zoneless test setup only
    // propagates an update into an OnPush child's input() when the host
    // template reads a signal.
    currentValue = signal('');
    masked = signal(false);
    shiftActive = signal(false);
    focusedIndex = signal<number | null>(null);
}

describe('TvOnscreenKeyboardComponent', () => {
    function createHost() {
        const fixture = TestBed.createComponent(HostComponent);
        fixture.detectChanges();
        return fixture;
    }

    beforeEach(() => {
        TestBed.configureTestingModule({ imports: [HostComponent] });
    });

    function keys(fixture: ReturnType<typeof createHost>) {
        return fixture.nativeElement.querySelectorAll(
            '.tv-onscreen-keyboard__key'
        );
    }

    it('renders exactly 50 keys', () => {
        const fixture = createHost();
        expect(keys(fixture).length).toBe(50);
    });

    it('shows lowercase letters by default and uppercase when shift is active', () => {
        const fixture = createHost();
        expect(keys(fixture)[10].textContent?.trim()).toBe('q');

        fixture.componentInstance.shiftActive.set(true);
        fixture.detectChanges();

        expect(keys(fixture)[10].textContent?.trim()).toBe('Q');
    });

    it('marks the focused key', () => {
        const fixture = createHost();
        fixture.componentInstance.focusedIndex.set(5);
        fixture.detectChanges();

        expect(keys(fixture)[5].classList).toContain(
            'tv-onscreen-keyboard__key--focused'
        );
        expect(keys(fixture)[0].classList).not.toContain(
            'tv-onscreen-keyboard__key--focused'
        );
    });

    it('shows the current value in the preview', () => {
        const fixture = createHost();
        fixture.componentInstance.currentValue.set('hello');
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector(
                '.tv-onscreen-keyboard__preview'
            ).textContent
        ).toContain('hello');
    });

    it('masks the preview with bullets, capped at 24 characters', () => {
        const fixture = createHost();
        fixture.componentInstance.masked.set(true);
        fixture.componentInstance.currentValue.set('a'.repeat(40));
        fixture.detectChanges();

        const preview = fixture.nativeElement.querySelector(
            '.tv-onscreen-keyboard__preview'
        ).textContent.trim();
        expect(preview).toBe('•'.repeat(24));
    });
});
