import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TvAddSourceFieldRowComponent } from './tv-add-source-field-row.component';

@Component({
    imports: [TvAddSourceFieldRowComponent],
    template: `<app-tv-add-source-field-row
        [label]="label()"
        [value]="value()"
        [masked]="masked()"
        [focused]="focused()"
    />`,
})
class HostComponent {
    label = signal('Server URL');
    value = signal('');
    masked = signal(false);
    focused = signal(false);
}

describe('TvAddSourceFieldRowComponent', () => {
    function createHost() {
        const fixture = TestBed.createComponent(HostComponent);
        fixture.detectChanges();
        return fixture;
    }

    beforeEach(() => {
        TestBed.configureTestingModule({ imports: [HostComponent] });
    });

    it('shows the placeholder when the value is empty', () => {
        const fixture = createHost();
        expect(
            fixture.nativeElement.querySelector(
                '.tv-add-source-field-row__value'
            ).textContent
        ).toContain('Not set');
    });

    it('shows the plain value when set', () => {
        const fixture = createHost();
        fixture.componentInstance.value.set('https://panel.test');
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector(
                '.tv-add-source-field-row__value'
            ).textContent
        ).toContain('https://panel.test');
    });

    it('masks a non-empty value, capped at 24 characters', () => {
        const fixture = createHost();
        fixture.componentInstance.masked.set(true);
        fixture.componentInstance.value.set('a'.repeat(40));
        fixture.detectChanges();

        expect(
            fixture.nativeElement
                .querySelector('.tv-add-source-field-row__value')
                .textContent.trim()
        ).toBe('•'.repeat(24));
    });

    it('applies the focused class when focused', () => {
        const fixture = createHost();
        fixture.componentInstance.focused.set(true);
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector('.tv-add-source-field-row')
                .classList
        ).toContain('tv-add-source-field-row--focused');
    });
});
