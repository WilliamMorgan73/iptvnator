import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TvPendingPaneService } from '@iptvnator/tv/data-access';
import { TvDashboardScreenComponent } from './tv-dashboard-screen.component';

function pressKey(key: string, init: KeyboardEventInit = {}): void {
    document.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
    );
}

describe('TvDashboardScreenComponent', () => {
    let request: jest.Mock;
    let navigateByUrl: jest.SpyInstance;

    beforeEach(() => {
        request = jest.fn();

        TestBed.configureTestingModule({
            imports: [TvDashboardScreenComponent],
            providers: [
                provideRouter([]),
                { provide: TvPendingPaneService, useValue: { request } },
            ],
        });
        navigateByUrl = jest
            .spyOn(TestBed.inject(Router), 'navigateByUrl')
            .mockResolvedValue(true);
    });

    async function createFixture() {
        const fixture = TestBed.createComponent(TvDashboardScreenComponent);
        fixture.detectChanges();
        await fixture.whenStable();
        return fixture;
    }

    function entries(fixture: Awaited<ReturnType<typeof createFixture>>) {
        return fixture.nativeElement.querySelectorAll(
            '.tv-dashboard-screen__entry'
        );
    }

    it('shows all six entries with the first one focused', async () => {
        const fixture = await createFixture();

        const rows = entries(fixture);
        expect(rows.length).toBe(6);
        expect(rows[0].textContent).toContain('Live TV');
        expect(rows[0].classList).toContain(
            'tv-dashboard-screen__entry--focused'
        );
    });

    it('moves focus down with the D-pad', async () => {
        const fixture = await createFixture();

        pressKey('ArrowDown');
        fixture.detectChanges();

        expect(entries(fixture)[1].classList).toContain(
            'tv-dashboard-screen__entry--focused'
        );
    });

    it('navigates to /live when Live TV is activated', async () => {
        await createFixture();

        pressKey('Enter');

        expect(navigateByUrl).toHaveBeenCalledWith('/live');
        expect(request).not.toHaveBeenCalled();
    });

    it.each([
        ['recent', 1],
        ['recordings', 2],
        ['sources', 3],
        ['settings', 5],
    ] as const)(
        'requests the %s pane and navigates to /live',
        async (pane, downPresses) => {
            await createFixture();

            for (let i = 0; i < downPresses; i += 1) {
                pressKey('ArrowDown');
            }
            pressKey('Enter');

            expect(request).toHaveBeenCalledWith(pane);
            expect(navigateByUrl).toHaveBeenCalledWith('/live');
        }
    );

    it('navigates to /add-source when Add a source is activated', async () => {
        await createFixture();

        for (let i = 0; i < 4; i += 1) {
            pressKey('ArrowDown');
        }
        pressKey('Enter');

        expect(navigateByUrl).toHaveBeenCalledWith('/add-source');
        expect(request).not.toHaveBeenCalled();
    });

    it('navigates to /live when Back is pressed', async () => {
        await createFixture();

        pressKey('Escape');

        expect(navigateByUrl).toHaveBeenCalledWith('/live');
    });
});
