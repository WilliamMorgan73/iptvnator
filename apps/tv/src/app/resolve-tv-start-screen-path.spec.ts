import { TestBed } from '@angular/core/testing';
import { SettingsStore } from '@iptvnator/services';
import type { Settings } from '@iptvnator/shared/interfaces';
import { resolveTvStartScreenPath } from './resolve-tv-start-screen-path';

function configureWith(tvStartScreen: Settings['tvStartScreen']): void {
    TestBed.configureTestingModule({
        providers: [
            {
                provide: SettingsStore,
                useValue: { getSettings: () => ({ tvStartScreen }) },
            },
        ],
    });
}

describe('resolveTvStartScreenPath', () => {
    it('resolves to /live when unset', () => {
        configureWith(undefined);

        expect(
            TestBed.runInInjectionContext(resolveTvStartScreenPath)
        ).toBe('/live');
    });

    it('resolves to /live for the explicit live value', () => {
        configureWith('live');

        expect(
            TestBed.runInInjectionContext(resolveTvStartScreenPath)
        ).toBe('/live');
    });

    it('resolves to /dashboard when set', () => {
        configureWith('dashboard');

        expect(
            TestBed.runInInjectionContext(resolveTvStartScreenPath)
        ).toBe('/dashboard');
    });
});
