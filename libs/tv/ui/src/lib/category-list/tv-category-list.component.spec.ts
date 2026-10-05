import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { TvLiveCategory } from '@iptvnator/tv/util';
import { TvCategoryListComponent } from './tv-category-list.component';

const CATEGORIES: TvLiveCategory[] = [
    { id: 'all', name: 'All' },
    { id: 'sports', name: 'Sports' },
    { id: 'news', name: 'News' },
];

@Component({
    imports: [TvCategoryListComponent],
    template: `<app-tv-category-list
        [categories]="categories"
        [selectedCategoryId]="selectedCategoryId()"
        [focusedIndex]="focusedIndex()"
        [paneActive]="paneActive()"
    />`,
})
class HostComponent {
    categories = CATEGORIES;
    selectedCategoryId = signal<string | null>('all');
    focusedIndex = signal<number | null>(0);
    paneActive = signal(false);
}

describe('TvCategoryListComponent', () => {
    function createHost() {
        const fixture = TestBed.createComponent(HostComponent);
        fixture.detectChanges();
        return fixture;
    }

    beforeEach(() => {
        TestBed.configureTestingModule({ imports: [HostComponent] });
    });

    function rows(fixture: ReturnType<typeof createHost>) {
        return fixture.nativeElement.querySelectorAll('.tv-category-list__row');
    }

    it('renders every category by name', () => {
        const fixture = createHost();
        const r = rows(fixture);
        expect(r.length).toBe(3);
        expect(r[0].textContent).toContain('All');
        expect(r[1].textContent).toContain('Sports');
        expect(r[2].textContent).toContain('News');
    });

    it('marks the confirmed selection regardless of pane-active state', () => {
        const fixture = createHost();
        expect(rows(fixture)[0].classList).toContain(
            'tv-category-list__row--selected'
        );
        expect(rows(fixture)[1].classList).not.toContain(
            'tv-category-list__row--selected'
        );
    });

    it('only shows the focus ring while the pane is active', () => {
        const fixture = createHost();
        expect(rows(fixture)[0].classList).not.toContain(
            'tv-category-list__row--focused'
        );

        fixture.componentInstance.paneActive.set(true);
        fixture.detectChanges();

        expect(rows(fixture)[0].classList).toContain(
            'tv-category-list__row--focused'
        );
    });

    it('moves the focus ring as focusedIndex changes', () => {
        const fixture = createHost();
        fixture.componentInstance.paneActive.set(true);
        fixture.componentInstance.focusedIndex.set(2);
        fixture.detectChanges();

        expect(rows(fixture)[2].classList).toContain(
            'tv-category-list__row--focused'
        );
        expect(rows(fixture)[0].classList).not.toContain(
            'tv-category-list__row--focused'
        );
    });

    it('scrolls the focused row into view as focus moves', async () => {
        const fixture = createHost();
        const host = fixture.nativeElement.querySelector(
            'app-tv-category-list'
        ) as HTMLElement;
        const scrollTo = jest.fn();
        host.scrollTo = scrollTo;

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
        // Regression test, same shape as TvCategoryPillsComponent's: an
        // environment without Element.prototype.scrollTo (jsdom) previously
        // let this microtask throw uncaught.
        const fixture = createHost();
        const host = fixture.nativeElement.querySelector(
            'app-tv-category-list'
        ) as HTMLElement & { scrollTo?: unknown };
        delete (host as { scrollTo?: unknown }).scrollTo;

        fixture.componentInstance.focusedIndex.set(2);
        fixture.detectChanges();
        await Promise.resolve();

        expect(host.isConnected).toBe(true);
    });
});
