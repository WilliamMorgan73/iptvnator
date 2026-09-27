import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TvRecordingIndicatorComponent } from './tv-recording-indicator.component';

@Component({
    imports: [TvRecordingIndicatorComponent],
    template: `<app-tv-recording-indicator [startedAt]="startedAt()" />`,
})
class HostComponent {
    startedAt = signal<string | null>(null);
}

describe('TvRecordingIndicatorComponent', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-09-27T12:00:00Z'));
        TestBed.configureTestingModule({ imports: [HostComponent] });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('renders nothing while nothing is recording', () => {
        const fixture = TestBed.createComponent(HostComponent);
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector('.tv-recording-indicator')
        ).toBeNull();
    });

    it('shows 0:00 immediately after a recording starts', () => {
        const fixture = TestBed.createComponent(HostComponent);
        fixture.componentInstance.startedAt.set('2026-09-27T12:00:00Z');
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector(
                '.tv-recording-indicator__label'
            ).textContent
        ).toContain('0:00');
    });

    it('counts up minutes:seconds as time passes', () => {
        const fixture = TestBed.createComponent(HostComponent);
        fixture.componentInstance.startedAt.set('2026-09-27T12:00:00Z');
        fixture.detectChanges();

        jest.advanceTimersByTime(125_000); // 2:05
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector(
                '.tv-recording-indicator__label'
            ).textContent
        ).toContain('2:05');
    });

    it('switches to h:mm:ss past one hour', () => {
        const fixture = TestBed.createComponent(HostComponent);
        fixture.componentInstance.startedAt.set('2026-09-27T12:00:00Z');
        fixture.detectChanges();

        jest.advanceTimersByTime(3_909_000); // 1:05:09
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector(
                '.tv-recording-indicator__label'
            ).textContent
        ).toContain('1:05:09');
    });

    it('hides again once the recording stops', () => {
        const fixture = TestBed.createComponent(HostComponent);
        fixture.componentInstance.startedAt.set('2026-09-27T12:00:00Z');
        fixture.detectChanges();
        fixture.componentInstance.startedAt.set(null);
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector('.tv-recording-indicator')
        ).toBeNull();
    });
});
