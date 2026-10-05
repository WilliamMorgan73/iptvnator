import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { TvSettingsItem } from '@iptvnator/tv/util';
import { TvSettingsPanelComponent } from './tv-settings-panel.component';

const ITEMS: TvSettingsItem[] = [
    { id: 'language', label: 'Language', kind: 'select', valueLabel: 'English' },
    { id: 'theme', label: 'Theme', kind: 'select', valueLabel: 'System' },
    {
        id: 'showCaptions',
        label: 'Show captions',
        kind: 'toggle',
        valueLabel: 'Off',
    },
];

@Component({
    imports: [TvSettingsPanelComponent],
    template: `<app-tv-settings-panel
        [items]="items"
        [focusedIndex]="focusedIndex()"
    />`,
})
class HostComponent {
    items = ITEMS;
    focusedIndex = signal<number | null>(0);
}

describe('TvSettingsPanelComponent', () => {
    function createHost() {
        const fixture = TestBed.createComponent(HostComponent);
        fixture.detectChanges();
        return fixture;
    }

    beforeEach(() => {
        TestBed.configureTestingModule({ imports: [HostComponent] });
    });

    it('renders every item with its label and current value', () => {
        const fixture = createHost();
        const rows = fixture.nativeElement.querySelectorAll(
            '.tv-settings-panel__row'
        );
        expect(rows.length).toBe(3);
        expect(rows[0].textContent).toContain('Language');
        expect(rows[0].textContent).toContain('English');
        expect(rows[1].textContent).toContain('Theme');
        expect(rows[1].textContent).toContain('System');
        expect(rows[2].textContent).toContain('Show captions');
        expect(rows[2].textContent).toContain('Off');
    });

    it('marks the focused row and shows its left/right arrows only there', () => {
        const fixture = createHost();
        const rows = () =>
            fixture.nativeElement.querySelectorAll('.tv-settings-panel__row');

        expect(rows()[0].classList).toContain(
            'tv-settings-panel__row--focused'
        );
        expect(
            rows()[0].querySelectorAll('.tv-settings-panel__arrow').length
        ).toBe(2);
        expect(
            rows()[1].querySelectorAll('.tv-settings-panel__arrow').length
        ).toBe(0);

        fixture.componentInstance.focusedIndex.set(2);
        fixture.detectChanges();

        expect(rows()[2].classList).toContain(
            'tv-settings-panel__row--focused'
        );
        expect(rows()[0].classList).not.toContain(
            'tv-settings-panel__row--focused'
        );
        expect(
            rows()[2].querySelectorAll('.tv-settings-panel__arrow').length
        ).toBe(2);
    });

    it('renders no focused row when focusedIndex is null', () => {
        const fixture = createHost();
        fixture.componentInstance.focusedIndex.set(null);
        fixture.detectChanges();

        const rows = fixture.nativeElement.querySelectorAll(
            '.tv-settings-panel__row'
        );
        expect(
            fixture.nativeElement.querySelectorAll(
                '.tv-settings-panel__row--focused'
            ).length
        ).toBe(0);
        expect(rows[0].querySelectorAll('.tv-settings-panel__arrow').length).toBe(
            0
        );
    });

    it('scrolls the focused row into view as focus moves', async () => {
        const fixture = createHost();
        const container = fixture.nativeElement.querySelector(
            '.tv-settings-panel'
        ) as HTMLElement;
        const scrollTo = jest.fn();
        container.scrollTo = scrollTo;

        fixture.componentInstance.focusedIndex.set(2);
        fixture.detectChanges();
        // The scroll-into-view runs inside a queueMicrotask so DOM layout
        // from the just-flushed change detection has settled.
        await Promise.resolve();

        expect(scrollTo).toHaveBeenCalledWith(
            expect.objectContaining({ top: expect.any(Number) })
        );
    });

    it('does not throw out of the scroll-into-view microtask when scrollTo is unavailable', async () => {
        // Regression test, same shape as TvCategoryListComponent's: an
        // environment without Element.prototype.scrollTo (jsdom) previously
        // let this microtask throw uncaught.
        const fixture = createHost();
        const container = fixture.nativeElement.querySelector(
            '.tv-settings-panel'
        ) as HTMLElement & { scrollTo?: unknown };
        delete container.scrollTo;

        fixture.componentInstance.focusedIndex.set(2);
        fixture.detectChanges();
        await Promise.resolve();

        expect(container.isConnected).toBe(true);
    });
});
