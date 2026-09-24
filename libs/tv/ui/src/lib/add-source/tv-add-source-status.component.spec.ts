import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TvAddSourceStatusComponent } from './tv-add-source-status.component';

@Component({
    imports: [TvAddSourceStatusComponent],
    template: `<app-tv-add-source-status
        [message]="message()"
        [tone]="tone()"
    />`,
})
class HostComponent {
    message = signal<string | null>(null);
    tone = signal<'error' | 'info'>('error');
}

describe('TvAddSourceStatusComponent', () => {
    function createHost() {
        const fixture = TestBed.createComponent(HostComponent);
        fixture.detectChanges();
        return fixture;
    }

    beforeEach(() => {
        TestBed.configureTestingModule({ imports: [HostComponent] });
    });

    it('renders nothing when there is no message', () => {
        const fixture = createHost();
        expect(
            fixture.nativeElement.querySelector('.tv-add-source-status')
        ).toBeNull();
    });

    it('renders the message with the error tone by default', () => {
        const fixture = createHost();
        fixture.componentInstance.message.set('Enter a valid MAC address.');
        fixture.detectChanges();

        const el = fixture.nativeElement.querySelector(
            '.tv-add-source-status'
        );
        expect(el.textContent).toContain('Enter a valid MAC address.');
        expect(el.classList).toContain('tv-add-source-status--error');
    });

    it('omits the error class for an info tone', () => {
        const fixture = createHost();
        fixture.componentInstance.message.set('Portal validated.');
        fixture.componentInstance.tone.set('info');
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector('.tv-add-source-status')
                .classList
        ).not.toContain('tv-add-source-status--error');
    });
});
