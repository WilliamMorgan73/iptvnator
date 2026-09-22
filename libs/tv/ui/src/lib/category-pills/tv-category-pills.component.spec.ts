import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { TvLiveCategory } from '@iptvnator/tv/util';
import { TvCategoryPillsComponent } from './tv-category-pills.component';

const CATEGORIES: TvLiveCategory[] = [
    { id: 'all', name: 'All' },
    { id: 'sports', name: 'Sports' },
    { id: 'news', name: 'News' },
];

@Component({
    imports: [TvCategoryPillsComponent],
    template: `<app-tv-category-pills
        [categories]="categories"
        [selectedCategoryId]="selectedCategoryId()"
        [focusedIndex]="focusedIndex()"
        [paneActive]="paneActive()"
    />`,
})
class HostComponent {
    categories = CATEGORIES;
    selectedCategoryId = signal<string | null>('sports');
    focusedIndex = signal<number | null>(1);
    paneActive = signal(false);
}

describe('TvCategoryPillsComponent', () => {
    function createHost() {
        const fixture = TestBed.createComponent(HostComponent);
        fixture.detectChanges();
        return fixture;
    }

    beforeEach(() => {
        TestBed.configureTestingModule({ imports: [HostComponent] });
    });

    it('marks the selected category regardless of pane activity', () => {
        const fixture = createHost();
        const pills = fixture.nativeElement.querySelectorAll(
            '.tv-category-pills__pill'
        );
        expect(pills[1].classList).toContain(
            'tv-category-pills__pill--selected'
        );
        expect(pills[0].classList).not.toContain(
            'tv-category-pills__pill--selected'
        );
    });

    it('marks the focused pill only while the pane is active', () => {
        const fixture = createHost();
        const pills = () =>
            fixture.nativeElement.querySelectorAll(
                '.tv-category-pills__pill'
            );

        expect(pills()[1].classList).not.toContain(
            'tv-category-pills__pill--focused'
        );

        fixture.componentInstance.paneActive.set(true);
        fixture.detectChanges();
        expect(pills()[1].classList).toContain(
            'tv-category-pills__pill--focused'
        );
    });

    it('scrolls the focused pill into view as focus moves', async () => {
        const fixture = createHost();
        const container = fixture.nativeElement.querySelector(
            '.tv-category-pills'
        ) as HTMLElement;
        const scrollTo = jest.fn();
        container.scrollTo = scrollTo;

        fixture.componentInstance.focusedIndex.set(2);
        fixture.detectChanges();
        // The scroll-into-view runs inside a queueMicrotask so DOM layout
        // from the just-flushed change detection has settled.
        await Promise.resolve();

        expect(scrollTo).toHaveBeenCalledWith(
            expect.objectContaining({ left: expect.any(Number) })
        );
    });

    it('does not throw out of the scroll-into-view microtask when scrollTo is unavailable', async () => {
        // Regression test: an environment without `Element.prototype.
        // scrollTo` (jsdom) previously let this microtask throw
        // uncaught, which under `jest.useFakeTimers()` left the fake
        // clock unable to settle and hung the whole test run.
        const fixture = createHost();
        const container = fixture.nativeElement.querySelector(
            '.tv-category-pills'
        ) as HTMLElement & { scrollTo?: unknown };
        delete container.scrollTo;

        fixture.componentInstance.focusedIndex.set(2);
        fixture.detectChanges();
        // A regression here throws out of the queueMicrotask callback,
        // which Jest surfaces as a failure of this test.
        await Promise.resolve();

        expect(container.isConnected).toBe(true);
    });
});
