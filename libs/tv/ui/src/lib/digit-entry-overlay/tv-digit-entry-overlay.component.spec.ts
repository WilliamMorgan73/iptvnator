import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TvDigitEntryOverlayComponent } from './tv-digit-entry-overlay.component';

@Component({
    imports: [TvDigitEntryOverlayComponent],
    template: `<app-tv-digit-entry-overlay [digits]="digits()" />`,
})
class HostComponent {
    digits = signal('');
}

describe('TvDigitEntryOverlayComponent', () => {
    beforeEach(() => {
        TestBed.configureTestingModule({ imports: [HostComponent] });
    });

    it('renders nothing when there are no digits', () => {
        const fixture = TestBed.createComponent(HostComponent);
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector('.tv-digit-entry-overlay')
        ).toBeNull();
    });

    it('renders the typed digits once there are some', () => {
        const fixture = TestBed.createComponent(HostComponent);
        fixture.componentInstance.digits.set('205');
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector('.tv-digit-entry-overlay')
                .textContent
        ).toContain('205');
    });

    it('hides again once the digits are cleared', () => {
        const fixture = TestBed.createComponent(HostComponent);
        fixture.componentInstance.digits.set('2');
        fixture.detectChanges();
        fixture.componentInstance.digits.set('');
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector('.tv-digit-entry-overlay')
        ).toBeNull();
    });
});
