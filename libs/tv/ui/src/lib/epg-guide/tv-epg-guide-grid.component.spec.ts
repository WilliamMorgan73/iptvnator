import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { EpgProgram } from '@iptvnator/shared/interfaces';
import type { TvEpgGuideChannel, TvEpgGuideFocus } from '@iptvnator/tv/util';
import { TvEpgGuideGridComponent } from './tv-epg-guide-grid.component';

const CHANNELS: TvEpgGuideChannel[] = [
    { id: 'c1', number: 1, name: 'Nova Sports 1', logoUrl: null },
    { id: 'c2', number: 2, name: 'CNN News', logoUrl: null },
];

@Component({
    imports: [TvEpgGuideGridComponent],
    template: `<app-tv-epg-guide-grid
        [channels]="channels()"
        [programsByChannelId]="programsByChannelId()"
        [dateKey]="dateKey()"
        [loading]="loading()"
        [focus]="focus()"
        [nowMs]="nowMs()"
    />`,
})
class HostComponent {
    channels = signal<readonly TvEpgGuideChannel[]>(CHANNELS);
    programsByChannelId = signal<ReadonlyMap<string, EpgProgram[]>>(new Map());
    dateKey = signal('2026-09-27');
    loading = signal(false);
    focus = signal<TvEpgGuideFocus | null>(null);
    nowMs = signal(Date.parse('2026-09-27T06:00:00.000Z'));
}

describe('TvEpgGuideGridComponent', () => {
    function createHost() {
        const fixture = TestBed.createComponent(HostComponent);
        fixture.detectChanges();
        return fixture;
    }

    beforeEach(() => {
        TestBed.configureTestingModule({ imports: [HostComponent] });
    });

    it('renders one row per channel', () => {
        const fixture = createHost();
        const rows = fixture.nativeElement.querySelectorAll(
            'app-tv-epg-guide-row'
        );
        expect(rows.length).toBe(2);
    });

    it('shows a loading state before any channel arrives', () => {
        const fixture = createHost();
        fixture.componentInstance.channels.set([]);
        fixture.componentInstance.loading.set(true);
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector('.tv-epg-guide-grid__empty')
                .textContent
        ).toContain('Loading');
    });

    it('shows an empty state when there are no channels and nothing is loading', () => {
        const fixture = createHost();
        fixture.componentInstance.channels.set([]);
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector('.tv-epg-guide-grid__empty')
                .textContent
        ).toContain('No channels available');
    });

    it('renders a date label for the current dateKey', () => {
        const fixture = createHost();
        expect(
            fixture.nativeElement.querySelector('.tv-epg-guide-grid__date')
                .textContent.length
        ).toBeGreaterThan(0);
    });

    it('marks the focused row', () => {
        const fixture = createHost();
        fixture.componentInstance.focus.set({ row: 1, block: null });
        fixture.detectChanges();

        const rows = fixture.nativeElement.querySelectorAll(
            'app-tv-epg-guide-row'
        );
        expect(rows[1].querySelector('.tv-epg-guide-row').classList).toContain(
            'tv-epg-guide-row--focused'
        );
        expect(rows[0].querySelector('.tv-epg-guide-row').classList).not.toContain(
            'tv-epg-guide-row--focused'
        );
    });
});
