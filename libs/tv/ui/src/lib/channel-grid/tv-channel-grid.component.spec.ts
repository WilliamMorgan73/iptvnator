import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { TvLiveChannel } from '@iptvnator/tv/util';
import { TvChannelGridComponent } from './tv-channel-grid.component';

function channel(overrides: Partial<TvLiveChannel> = {}): TvLiveChannel {
    return {
        id: '1',
        name: 'Nova Sports 1',
        categoryId: 'sports',
        sourceKind: 'xtream',
        playRef: null,
        ...overrides,
    };
}

const CHANNELS: TvLiveChannel[] = [
    channel({ id: '1', name: 'Nova Sports 1', channelNumber: 101 }),
    channel({ id: '2', name: 'Nova Sports 2' }),
    channel({ id: '3', name: 'Nova News' }),
];

@Component({
    imports: [TvChannelGridComponent],
    template: `<app-tv-channel-grid
        [channels]="channels()"
        [focusedIndex]="focusedIndex()"
    />`,
})
class HostComponent {
    // A real signal, not a plain field — this repo's zoneless test setup
    // only propagates an update into an OnPush child's input() when the
    // host template reads a signal (see tv-channel-info-overlay's spec for
    // the same pattern).
    channels = signal<TvLiveChannel[]>(CHANNELS);
    focusedIndex = signal<number | null>(0);
}

describe('TvChannelGridComponent', () => {
    function createHost() {
        const fixture = TestBed.createComponent(HostComponent);
        fixture.detectChanges();
        return fixture;
    }

    beforeEach(() => {
        TestBed.configureTestingModule({ imports: [HostComponent] });
    });

    function tiles(fixture: ReturnType<typeof createHost>) {
        return fixture.nativeElement.querySelectorAll('.tv-channel-grid__tile');
    }

    it('renders every channel as a tile with its number and name', () => {
        const fixture = createHost();
        const rows = tiles(fixture);

        expect(rows.length).toBe(3);
        expect(rows[0].textContent).toContain('101');
        expect(rows[0].textContent).toContain('Nova Sports 1');
        expect(rows[1].textContent).toContain('Nova Sports 2');
        expect(rows[1].querySelector('.tv-channel-grid__number')).toBeNull();
    });

    it('shows initials when a channel has no logoUrl', () => {
        const fixture = createHost();
        expect(tiles(fixture)[0].textContent).toContain('NS');
        expect(
            tiles(fixture)[0].querySelector('.tv-channel-grid__logo-image')
        ).toBeNull();
    });

    it('shows the logo image when logoUrl is known, falling back on error', () => {
        const fixture = createHost();
        fixture.componentInstance.channels.set([
            channel({ id: '1', logoUrl: 'https://logos.test/nova.png' }),
        ]);
        fixture.detectChanges();

        const img = tiles(fixture)[0].querySelector(
            '.tv-channel-grid__logo-image'
        );
        expect(img).not.toBeNull();

        img.dispatchEvent(new Event('error'));
        fixture.detectChanges();

        expect(
            tiles(fixture)[0].querySelector('.tv-channel-grid__logo-image')
        ).toBeNull();
        expect(tiles(fixture)[0].textContent).toContain('N');
    });

    it('marks the focused tile as focus moves', () => {
        const fixture = createHost();

        expect(tiles(fixture)[0].classList).toContain(
            'tv-channel-grid__tile--focused'
        );

        fixture.componentInstance.focusedIndex.set(2);
        fixture.detectChanges();

        expect(tiles(fixture)[2].classList).toContain(
            'tv-channel-grid__tile--focused'
        );
        expect(tiles(fixture)[0].classList).not.toContain(
            'tv-channel-grid__tile--focused'
        );
    });

    it('shows the progress bar only on the focused tile, and only when known', () => {
        const fixture = createHost();
        fixture.componentInstance.channels.set([
            channel({ id: '1', currentProgramProgress: 0.4 }),
            channel({ id: '2', currentProgramProgress: 0.7 }),
            channel({ id: '3' }),
        ]);
        fixture.componentInstance.focusedIndex.set(1);
        fixture.detectChanges();

        expect(
            tiles(fixture)[0].querySelector('.tv-channel-grid__progress-fill')
        ).toBeNull();
        const focusedFill = tiles(fixture)[1].querySelector(
            '.tv-channel-grid__progress-fill'
        );
        expect(focusedFill).not.toBeNull();
        expect(focusedFill.style.width).toBe('70%');

        fixture.componentInstance.focusedIndex.set(2);
        fixture.detectChanges();
        expect(
            tiles(fixture)[2].querySelector('.tv-channel-grid__progress-fill')
        ).toBeNull();
    });

    it('shows an empty-state message instead of a grid when there are no channels', () => {
        const fixture = createHost();
        fixture.componentInstance.channels.set([]);
        fixture.detectChanges();

        expect(tiles(fixture).length).toBe(0);
        expect(
            fixture.nativeElement.querySelector('.tv-channel-grid__empty')
                ?.textContent
        ).toContain('No channels in this category');
    });

    it('scrolls the focused tile into view as focus moves', async () => {
        const fixture = createHost();
        const host = fixture.nativeElement.querySelector(
            'app-tv-channel-grid'
        ) as HTMLElement;
        const scrollTo = jest.fn();
        host.scrollTo = scrollTo;

        fixture.componentInstance.focusedIndex.set(2);
        fixture.detectChanges();
        await Promise.resolve();

        expect(scrollTo).toHaveBeenCalledWith(
            expect.objectContaining({ top: expect.any(Number) })
        );
    });

    it('does not throw out of the scroll-into-view microtask when scrollTo is unavailable', async () => {
        const fixture = createHost();
        const host = fixture.nativeElement.querySelector(
            'app-tv-channel-grid'
        ) as HTMLElement & { scrollTo?: unknown };
        delete (host as { scrollTo?: unknown }).scrollTo;

        fixture.componentInstance.focusedIndex.set(2);
        fixture.detectChanges();
        await Promise.resolve();

        expect(host.isConnected).toBe(true);
    });
});
