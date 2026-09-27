import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { EpgProgram } from '@iptvnator/shared/interfaces';
import type { TvEpgGuideChannel } from '@iptvnator/tv/util';
import { TvEpgGuideRowComponent } from './tv-epg-guide-row.component';

const DAY_START = Date.parse('2026-09-27T00:00:00.000Z');
const DAY_END = DAY_START + 24 * 60 * 60 * 1000;

const CHANNEL: TvEpgGuideChannel = {
    id: 'c1',
    number: 1,
    name: 'Nova Sports 1',
    logoUrl: null,
};

const PROGRAMS: EpgProgram[] = [
    {
        title: 'Morning Show',
        start: '2026-09-27T06:00:00.000Z',
        stop: '2026-09-27T08:00:00.000Z',
    } as EpgProgram,
    {
        title: 'Match of the Day',
        start: '2026-09-27T08:00:00.000Z',
        stop: '2026-09-27T10:00:00.000Z',
    } as EpgProgram,
];

@Component({
    imports: [TvEpgGuideRowComponent],
    template: `<app-tv-epg-guide-row
        [channel]="channel()"
        [programs]="programs()"
        [windowFromMs]="windowFromMs()"
        [windowToMs]="windowToMs()"
        [nowMs]="nowMs()"
        [focused]="focused()"
        [focusedBlock]="focusedBlock()"
    />`,
})
class HostComponent {
    channel = signal<TvEpgGuideChannel>(CHANNEL);
    programs = signal<readonly EpgProgram[]>(PROGRAMS);
    windowFromMs = signal(DAY_START);
    windowToMs = signal(DAY_END);
    nowMs = signal<number | null>(null);
    focused = signal(false);
    focusedBlock = signal<number | null>(null);
}

describe('TvEpgGuideRowComponent', () => {
    function createHost() {
        const fixture = TestBed.createComponent(HostComponent);
        fixture.detectChanges();
        return fixture;
    }

    beforeEach(() => {
        TestBed.configureTestingModule({ imports: [HostComponent] });
    });

    it('renders the channel name and one block per programme', () => {
        const fixture = createHost();

        expect(
            fixture.nativeElement.querySelector('.tv-epg-guide-row__name')
                .textContent
        ).toContain('Nova Sports 1');
        const blocks = fixture.nativeElement.querySelectorAll(
            '.tv-epg-guide-row__block'
        );
        expect(blocks.length).toBe(2);
        expect(blocks[0].textContent).toContain('Morning Show');
        expect(blocks[1].textContent).toContain('Match of the Day');
    });

    it('positions blocks using percentage layout', () => {
        const fixture = createHost();
        const block = fixture.nativeElement.querySelector(
            '.tv-epg-guide-row__block'
        );

        expect(block.style.left).toBe('25%');
    });

    it('shows an empty state when there is no programme data', () => {
        const fixture = createHost();
        fixture.componentInstance.programs.set([]);
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector('.tv-epg-guide-row__no-data')
        ).toBeTruthy();
        expect(
            fixture.nativeElement.querySelectorAll(
                '.tv-epg-guide-row__block'
            ).length
        ).toBe(0);
    });

    it('renders a now-line only when nowMs falls inside the window', () => {
        const fixture = createHost();
        expect(
            fixture.nativeElement.querySelector('.tv-epg-guide-row__now-line')
        ).toBeNull();

        fixture.componentInstance.nowMs.set(DAY_START + 6 * 60 * 60 * 1000);
        fixture.detectChanges();
        const nowLine = fixture.nativeElement.querySelector(
            '.tv-epg-guide-row__now-line'
        );
        expect(nowLine).toBeTruthy();
        expect(nowLine.style.left).toBe('25%');
    });

    it('marks the row and focused block only when the row itself is focused', () => {
        const fixture = createHost();
        fixture.componentInstance.focused.set(true);
        fixture.componentInstance.focusedBlock.set(1);
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector('.tv-epg-guide-row').classList
        ).toContain('tv-epg-guide-row--focused');
        const blocks = fixture.nativeElement.querySelectorAll(
            '.tv-epg-guide-row__block'
        );
        expect(blocks[0].classList).not.toContain(
            'tv-epg-guide-row__block--focused'
        );
        expect(blocks[1].classList).toContain(
            'tv-epg-guide-row__block--focused'
        );
    });
});
