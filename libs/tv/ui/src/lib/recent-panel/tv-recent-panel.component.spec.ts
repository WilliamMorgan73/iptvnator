import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { TvLiveChannel } from '@iptvnator/tv/util';
import { TvRecentPanelComponent } from './tv-recent-panel.component';

function channel(overrides: Partial<TvLiveChannel>): TvLiveChannel {
    return {
        id: 'c1',
        name: 'Channel',
        categoryId: 'all',
        sourceKind: 'xtream',
        playRef: null,
        ...overrides,
    };
}

const CHANNELS: TvLiveChannel[] = [
    channel({ id: 'c1', name: 'Nova Sports 1', currentProgramTitle: 'Match of the Day' }),
    channel({ id: 'c2', name: 'CNN News' }),
];

@Component({
    imports: [TvRecentPanelComponent],
    template: `<app-tv-recent-panel
        [channels]="channels()"
        [focusedIndex]="focusedIndex()"
    />`,
})
class HostComponent {
    channels = signal<readonly TvLiveChannel[]>(CHANNELS);
    focusedIndex = signal<number | null>(0);
}

describe('TvRecentPanelComponent', () => {
    function createHost() {
        const fixture = TestBed.createComponent(HostComponent);
        fixture.detectChanges();
        return fixture;
    }

    beforeEach(() => {
        TestBed.configureTestingModule({ imports: [HostComponent] });
    });

    it('renders every recent channel with its name and current program', () => {
        const fixture = createHost();
        const rows = fixture.nativeElement.querySelectorAll(
            '.tv-recent-panel__row'
        );
        expect(rows.length).toBe(2);
        expect(rows[0].textContent).toContain('Nova Sports 1');
        expect(rows[0].textContent).toContain('Match of the Day');
        expect(rows[1].textContent).toContain('CNN News');
    });

    it('marks the focused row as focus moves', () => {
        const fixture = createHost();
        const rows = () =>
            fixture.nativeElement.querySelectorAll('.tv-recent-panel__row');

        expect(rows()[0].classList).toContain('tv-recent-panel__row--focused');

        fixture.componentInstance.focusedIndex.set(1);
        fixture.detectChanges();
        expect(rows()[1].classList).toContain('tv-recent-panel__row--focused');
        expect(rows()[0].classList).not.toContain(
            'tv-recent-panel__row--focused'
        );
    });

    it('shows an empty state when there is no recent history', () => {
        const fixture = createHost();
        fixture.componentInstance.channels.set([]);
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector('.tv-recent-panel__empty')
                .textContent
        ).toContain('Nothing watched yet');
        expect(
            fixture.nativeElement.querySelectorAll('.tv-recent-panel__row')
                .length
        ).toBe(0);
    });

    it('scrolls the focused row into view as focus moves', async () => {
        const fixture = createHost();
        const container = fixture.nativeElement.querySelector(
            '.tv-recent-panel'
        ) as HTMLElement;
        const scrollTo = jest.fn();
        container.scrollTo = scrollTo;

        fixture.componentInstance.focusedIndex.set(1);
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
            '.tv-recent-panel'
        ) as HTMLElement & { scrollTo?: unknown };
        delete (container as { scrollTo?: unknown }).scrollTo;

        fixture.componentInstance.focusedIndex.set(1);
        fixture.detectChanges();
        await Promise.resolve();

        expect(container.isConnected).toBe(true);
    });
});
