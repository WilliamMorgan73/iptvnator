import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { RecordingItem } from '@iptvnator/services';
import { TvRecordingsPanelComponent } from './tv-recordings-panel.component';

function recording(overrides: Partial<RecordingItem>): RecordingItem {
    return {
        id: 1,
        status: 'completed',
        filePath: '/downloads/rec.ts',
        channelName: 'Channel',
        startedAt: '2026-09-27T12:00:00Z',
        fileAvailability: 'available',
        ...overrides,
    };
}

const RECORDINGS: RecordingItem[] = [
    recording({ id: 1, channelName: 'Nova Sports 1', status: 'recording' }),
    recording({ id: 2, channelName: 'CNN News', status: 'completed' }),
    recording({ id: 3, channelName: 'Old Capture', status: 'interrupted' }),
    recording({ id: 4, channelName: 'Bad Capture', status: 'failed' }),
];

@Component({
    imports: [TvRecordingsPanelComponent],
    template: `<app-tv-recordings-panel
        [recordings]="recordings()"
        [focusedIndex]="focusedIndex()"
    />`,
})
class HostComponent {
    recordings = signal<readonly RecordingItem[]>(RECORDINGS);
    focusedIndex = signal<number | null>(0);
}

describe('TvRecordingsPanelComponent', () => {
    function createHost() {
        const fixture = TestBed.createComponent(HostComponent);
        fixture.detectChanges();
        return fixture;
    }

    beforeEach(() => {
        TestBed.configureTestingModule({ imports: [HostComponent] });
    });

    it('renders every recording with a status label', () => {
        const fixture = createHost();
        const rows = fixture.nativeElement.querySelectorAll(
            '.tv-recordings-panel__row'
        );
        expect(rows.length).toBe(4);
        expect(rows[0].textContent).toContain('Nova Sports 1');
        expect(rows[0].textContent).toContain('Recording…');
        expect(rows[1].textContent).toContain('Ready');
        expect(rows[2].textContent).toContain('Partial');
        expect(rows[3].textContent).toContain('Failed');
    });

    it('marks an in-progress row with the recording modifier class', () => {
        const fixture = createHost();
        const rows = fixture.nativeElement.querySelectorAll(
            '.tv-recordings-panel__row'
        );
        expect(rows[0].classList).toContain(
            'tv-recordings-panel__row--recording'
        );
        expect(rows[1].classList).not.toContain(
            'tv-recordings-panel__row--recording'
        );
    });

    it('marks the focused row as focus moves', () => {
        const fixture = createHost();
        const rows = () =>
            fixture.nativeElement.querySelectorAll(
                '.tv-recordings-panel__row'
            );

        expect(rows()[0].classList).toContain(
            'tv-recordings-panel__row--focused'
        );

        fixture.componentInstance.focusedIndex.set(1);
        fixture.detectChanges();
        expect(rows()[1].classList).toContain(
            'tv-recordings-panel__row--focused'
        );
        expect(rows()[0].classList).not.toContain(
            'tv-recordings-panel__row--focused'
        );
    });

    it('shows an empty state when there are no recordings', () => {
        const fixture = createHost();
        fixture.componentInstance.recordings.set([]);
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector('.tv-recordings-panel__empty')
                .textContent
        ).toContain('No recordings yet');
    });

    it('scrolls the focused row into view as focus moves', async () => {
        const fixture = createHost();
        const container = fixture.nativeElement.querySelector(
            '.tv-recordings-panel'
        ) as HTMLElement;
        const scrollTo = jest.fn();
        container.scrollTo = scrollTo;

        fixture.componentInstance.focusedIndex.set(3);
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
            '.tv-recordings-panel'
        ) as HTMLElement & { scrollTo?: unknown };
        delete (container as { scrollTo?: unknown }).scrollTo;

        fixture.componentInstance.focusedIndex.set(3);
        fixture.detectChanges();
        await Promise.resolve();

        expect(container.isConnected).toBe(true);
    });
});
