import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { TvLiveSource } from '@iptvnator/tv/util';
import { TvSourcePanelComponent } from './tv-source-panel.component';

const SOURCES: TvLiveSource[] = [
    { id: 'p1', title: 'My Xtream', kind: 'xtream' },
    { id: 'p2', title: 'My Stalker', kind: 'stalker' },
    { id: 'p3', title: 'My M3U', kind: 'm3u' },
];

@Component({
    imports: [TvSourcePanelComponent],
    template: `<app-tv-source-panel
        [sources]="sources"
        [activeSourceId]="activeSourceId()"
        [focusedIndex]="focusedIndex()"
    />`,
})
class HostComponent {
    sources = SOURCES;
    activeSourceId = signal<string | null>('p1');
    focusedIndex = signal<number | null>(0);
}

describe('TvSourcePanelComponent', () => {
    function createHost() {
        const fixture = TestBed.createComponent(HostComponent);
        fixture.detectChanges();
        return fixture;
    }

    beforeEach(() => {
        TestBed.configureTestingModule({ imports: [HostComponent] });
    });

    it('renders every source with its title and kind label, plus a trailing Add source row', () => {
        const fixture = createHost();
        const rows = fixture.nativeElement.querySelectorAll(
            '.tv-source-panel__row'
        );
        expect(rows.length).toBe(4);
        expect(rows[0].textContent).toContain('My Xtream');
        expect(rows[0].textContent).toContain('Xtream');
        expect(rows[1].textContent).toContain('Stalker');
        expect(rows[2].textContent).toContain('M3U');
        expect(rows[3].textContent).toContain('Add source');
        expect(rows[3].classList).toContain('tv-source-panel__row--add');
    });

    it('focuses the trailing Add source row when focusedIndex points past the last source', () => {
        const fixture = createHost();
        fixture.componentInstance.focusedIndex.set(SOURCES.length);
        fixture.detectChanges();

        const rows = fixture.nativeElement.querySelectorAll(
            '.tv-source-panel__row'
        );
        expect(rows[SOURCES.length].classList).toContain(
            'tv-source-panel__row--focused'
        );
    });

    it('marks the active source with the active-dot and modifier class', () => {
        const fixture = createHost();
        const rows = fixture.nativeElement.querySelectorAll(
            '.tv-source-panel__row'
        );
        expect(rows[0].classList).toContain('tv-source-panel__row--active');
        expect(
            rows[0].querySelector('.tv-source-panel__active-dot')
        ).toBeTruthy();
        expect(rows[1].classList).not.toContain(
            'tv-source-panel__row--active'
        );
    });

    it('marks the focused row as focus moves', () => {
        const fixture = createHost();
        const rows = () =>
            fixture.nativeElement.querySelectorAll('.tv-source-panel__row');

        expect(rows()[0].classList).toContain('tv-source-panel__row--focused');

        fixture.componentInstance.focusedIndex.set(2);
        fixture.detectChanges();
        expect(rows()[2].classList).toContain('tv-source-panel__row--focused');
        expect(rows()[0].classList).not.toContain(
            'tv-source-panel__row--focused'
        );
    });

    it('scrolls the focused row into view as focus moves', async () => {
        const fixture = createHost();
        const container = fixture.nativeElement.querySelector(
            '.tv-source-panel'
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
            '.tv-source-panel'
        ) as HTMLElement & { scrollTo?: unknown };
        delete (container as { scrollTo?: unknown }).scrollTo;

        fixture.componentInstance.focusedIndex.set(2);
        fixture.detectChanges();
        await Promise.resolve();

        expect(container.isConnected).toBe(true);
    });
});
