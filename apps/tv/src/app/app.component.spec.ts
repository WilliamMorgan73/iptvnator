import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [AppComponent],
            providers: [provideRouter([])],
        });
    });

    it('creates and renders a router outlet', () => {
        const fixture = TestBed.createComponent(AppComponent);
        fixture.detectChanges();
        expect(fixture.componentInstance).toBeTruthy();
        expect(
            fixture.nativeElement.querySelector('router-outlet')
        ).not.toBeNull();
    });
});
