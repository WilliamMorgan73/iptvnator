import {
    EnvironmentProviders,
    Provider,
    importProvidersFrom,
    inject,
} from '@angular/core';
import { HttpClient, provideHttpClient, withXhr } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideEffects } from '@ngrx/effects';
import { provideStore } from '@ngrx/store';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { NgxIndexedDBModule } from 'ngx-indexed-db';
import { PlaylistEffects, playlistReducer } from '@iptvnator/m3u-state';
import { PortalPlayer, PORTAL_PLAYER } from '@iptvnator/portal/shared/util';
import { provideXtreamDataSource } from '@iptvnator/portal/xtream/data-access';
import { DataService } from '@iptvnator/services';
import { dbConfig } from '@iptvnator/shared/interfaces';
import { TvBrowserFallbackDataService } from './tv-browser-fallback-data.service';
import { TvElectronDataService } from './tv-electron-data.service';

/**
 * tv mode has no embedded/external player UI to launch from, so every
 * `PortalPlayer` method is unreachable in v1 — but XtreamStore's and
 * StalkerStore's player features `inject(PORTAL_PLAYER)` unconditionally at
 * construction, so the token still needs a value or the stores themselves
 * fail to construct.
 */
const TV_PORTAL_PLAYER_STUB: PortalPlayer = {
    isEmbeddedPlayer: () => true,
    openPlayer: async () => undefined,
    openResolvedPlayback: async () => undefined,
    openExternalPlayback: async () => undefined,
};

function tvDataServiceFactory(): DataService {
    const hasElectronBridge =
        typeof window !== 'undefined' &&
        !!(window as { electron?: unknown }).electron;
    return hasElectronBridge
        ? inject(TvElectronDataService)
        : inject(TvBrowserFallbackDataService);
}

function tvTranslateHttpLoaderFactory(http: HttpClient): TranslateHttpLoader {
    return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

/**
 * Everything XtreamStore/StalkerStore/PlaylistsService need to construct,
 * bundled so `apps/tv/app.config.ts` stays a thin composition root. This is
 * a real dependency chain surfaced by reusing the existing, verified stores
 * unmodified (the tv-mode plan's explicit design choice) rather than writing
 * lighter tv-specific replacements: PlaylistsService alone requires
 * MatSnackBar + TranslateService + NgxIndexedDBService.
 *
 * Deliberately NOT included: APP_CONFIG, CONFIRM_DIALOG_OPENER,
 * PLAYLIST_M3U_ACTIONS, PORTAL_DEBUG_EVENT_LOGGER — those exist only for
 * `ElectronService`'s consumption (MPV/VLC launch, M3U-by-URL import,
 * auto-update-playlists, translated snackbars), none of which tv mode's
 * lean TvElectronDataService/TvBrowserFallbackDataService need.
 */
export function provideTvDataAccess(): (Provider | EnvironmentProviders)[] {
    return [
        provideHttpClient(withXhr()),
        provideNoopAnimations(),
        importProvidersFrom(
            TranslateModule.forRoot({
                defaultLanguage: 'en',
                loader: {
                    provide: TranslateLoader,
                    useFactory: tvTranslateHttpLoaderFactory,
                    deps: [HttpClient],
                },
            })
        ),
        importProvidersFrom(NgxIndexedDBModule.forRoot(dbConfig)),
        provideStore({ playlistState: playlistReducer }),
        provideEffects([PlaylistEffects]),
        ...provideXtreamDataSource(),
        { provide: DataService, useFactory: tvDataServiceFactory },
        { provide: PORTAL_PLAYER, useValue: TV_PORTAL_PLAYER_STUB },
    ];
}
