import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { TvLiveChannel } from '@iptvnator/tv/util';
import { TvChannelListComponent } from './tv-channel-list.component';

const CHANNELS: TvLiveChannel[] = [
    {
        id: 'ch1',
        name: 'Nova Sports 1',
        categoryId: 'sports',
        sourceKind: 'xtream',
        channelNumber: 101,
        playRef: null,
        currentProgramTitle: 'Derby Final — 2nd half',
        currentProgramProgress: 0.64,
    },
    {
        id: 'ch2',
        name: 'Nova Sports 2',
        categoryId: 'sports',
        sourceKind: 'xtream',
        channelNumber: 102,
        playRef: null,
        currentProgramTitle: 'Weekly Highlights',
    },
];

@Component({
    imports: [TvChannelListComponent],
    template: `<app-tv-channel-list
        [channels]="channels"
        [focusedIndex]="focusedIndex()"
    />`,
})
class HostComponent {
    channels = CHANNELS;
    focusedIndex = signal<number | null>(0);
}

describe('TvChannelListComponent', () => {
    beforeEach(() => {
        TestBed.configureTestingModule({ imports: [HostComponent] });
    });

    it('renders one row per channel with its name and program title', () => {
        const fixture = TestBed.createComponent(HostComponent);
        fixture.detectChanges();
        const names = Array.from(
            fixture.nativeElement.querySelectorAll('.tv-channel-list__name')
        ).map((el) => (el as HTMLElement).textContent?.trim());
        expect(names).toEqual(['Nova Sports 1', 'Nova Sports 2']);
    });

    it('shows the progress bar only on the focused row', () => {
        const fixture = TestBed.createComponent(HostComponent);
        fixture.detectChanges();
        const rows = fixture.nativeElement.querySelectorAll(
            '.tv-channel-list__row'
        );
        expect(rows[0].classList).toContain('tv-channel-list__row--focused');
        expect(
            rows[0].querySelector('.tv-channel-list__progress-track')
        ).not.toBeNull();
        expect(
            rows[1].querySelector('.tv-channel-list__progress-track')
        ).toBeNull();
    });

    it('moves the focused styling when focusedIndex changes', () => {
        const fixture = TestBed.createComponent(HostComponent);
        fixture.detectChanges();
        fixture.componentInstance.focusedIndex.set(1);
        fixture.detectChanges();
        const rows = fixture.nativeElement.querySelectorAll(
            '.tv-channel-list__row'
        );
        expect(rows[0].classList).not.toContain(
            'tv-channel-list__row--focused'
        );
        expect(rows[1].classList).toContain('tv-channel-list__row--focused');
    });
});
