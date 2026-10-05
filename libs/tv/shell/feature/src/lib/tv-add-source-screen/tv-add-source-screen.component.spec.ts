import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TvAddSourceService, TvLiveCatalogFacade } from '@iptvnator/tv/data-access';
import { TvAddSourceScreenComponent } from './tv-add-source-screen.component';

function pressKey(key: string): void {
    document.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
    );
}

describe('TvAddSourceScreenComponent', () => {
    let addSource: jest.Mock;
    let addedNewSource: jest.Mock;
    let navigateByUrl: jest.SpyInstance;

    beforeEach(() => {
        addSource = jest.fn();
        addedNewSource = jest.fn().mockResolvedValue(undefined);

        TestBed.configureTestingModule({
            imports: [TvAddSourceScreenComponent],
            providers: [
                provideRouter([]),
                { provide: TvAddSourceService, useValue: { addSource } },
                { provide: TvLiveCatalogFacade, useValue: { addedNewSource } },
            ],
        });
        navigateByUrl = jest
            .spyOn(TestBed.inject(Router), 'navigateByUrl')
            .mockResolvedValue(true);
    });

    async function createFixture() {
        const fixture = TestBed.createComponent(TvAddSourceScreenComponent);
        fixture.detectChanges();
        await fixture.whenStable();
        return fixture;
    }

    function tabs(fixture: Awaited<ReturnType<typeof createFixture>>) {
        return fixture.nativeElement.querySelectorAll(
            '.tv-add-source-screen__tab'
        );
    }

    it('starts on the xtream tab with its fields shown', async () => {
        const fixture = await createFixture();

        expect(tabs(fixture)[0].classList).toContain(
            'tv-add-source-screen__tab--active'
        );
        expect(
            fixture.nativeElement.querySelectorAll('app-tv-add-source-field-row')
                .length
        ).toBe(4); // title, serverUrl, username, password
    });

    it('switches tabs on Right + Enter', async () => {
        const fixture = await createFixture();

        pressKey('ArrowRight');
        pressKey('Enter');
        fixture.detectChanges();

        expect(tabs(fixture)[1].classList).toContain(
            'tv-add-source-screen__tab--active'
        );
        expect(
            fixture.nativeElement.querySelectorAll('app-tv-add-source-field-row')
                .length
        ).toBe(3); // title, portalUrl, macAddress
    });

    it('types a value via the on-screen keyboard and commits it on Done', async () => {
        const fixture = await createFixture();

        pressKey('ArrowDown'); // tabs -> fields, focus "title"
        pressKey('Enter'); // begin editing "title"
        fixture.detectChanges();
        expect(
            fixture.nativeElement.querySelector('app-tv-onscreen-keyboard')
        ).not.toBeNull();

        pressKey('ArrowDown'); // row 1 of the keyboard, index 10 = 'q'
        pressKey('Enter'); // types 'q'
        for (let i = 0; i < 9; i += 1) {
            pressKey('ArrowRight'); // walk to column 9 (still row 1)
        }
        for (let i = 0; i < 3; i += 1) {
            pressKey('ArrowDown'); // walk down to row 4, column 9 = Done
        }
        pressKey('Enter'); // commit
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector('app-tv-onscreen-keyboard')
        ).toBeNull();
        const titleRow = fixture.nativeElement.querySelectorAll(
            'app-tv-add-source-field-row'
        )[0];
        expect(titleRow.textContent).toContain('q');
    });

    it('discards the edit when Back is pressed while editing', async () => {
        const fixture = await createFixture();

        pressKey('ArrowDown');
        pressKey('Enter'); // begin editing "title"
        pressKey('ArrowDown'); // 'q'
        pressKey('Enter');
        pressKey('Escape'); // Back while editing
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector('app-tv-onscreen-keyboard')
        ).toBeNull();
        const titleRow = fixture.nativeElement.querySelectorAll(
            'app-tv-add-source-field-row'
        )[0];
        expect(titleRow.textContent).toContain('Not set');
    });

    it('navigates to /live and refreshes the catalog on successful submit', async () => {
        addSource.mockResolvedValue({
            kind: 'added',
            playlist: { _id: 'new-1', title: 'New' },
        });
        const fixture = await createFixture();

        pressKey('ArrowDown'); // -> fields, title
        for (let i = 0; i < 4; i += 1) {
            pressKey('ArrowDown'); // walk to the synthetic submit row
        }
        pressKey('Enter');
        await fixture.whenStable();

        expect(addSource).toHaveBeenCalledWith('xtream', {});
        expect(addedNewSource).toHaveBeenCalledWith('new-1');
        expect(navigateByUrl).toHaveBeenCalledWith('/live');
    });

    it('shows the status row and does not navigate on a rejected submit', async () => {
        addSource.mockResolvedValue({
            kind: 'rejected',
            message: 'Invalid server URL.',
        });
        const fixture = await createFixture();

        pressKey('ArrowDown');
        for (let i = 0; i < 4; i += 1) {
            pressKey('ArrowDown');
        }
        pressKey('Enter');
        await fixture.whenStable();
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector('.tv-add-source-status')
                .textContent
        ).toContain('Invalid server URL.');
        expect(addedNewSource).not.toHaveBeenCalled();
        expect(navigateByUrl).not.toHaveBeenCalled();
    });

    it('navigates to /live when Back is pressed from the tabs region', async () => {
        await createFixture();

        pressKey('Escape');

        expect(navigateByUrl).toHaveBeenCalledWith('/live');
    });
});
