import { Injectable } from '@angular/core';
import { DataService } from '@iptvnator/services';

/**
 * tv mode is Electron-only (see the tv-mode plan's Context section) — there
 * is no PWA story for it the way `apps/web` has one. This exists purely so
 * `nx serve tv` in a plain browser (no `window.electron`) degrades to an
 * empty/no-playlists state instead of crashing DI: every portal call
 * ultimately goes through `DataService.sendIpcEvent`, which only a real
 * Electron bridge can answer.
 */
@Injectable({ providedIn: 'root' })
export class TvBrowserFallbackDataService extends DataService {
    getAppVersion(): string {
        return '0.0.0';
    }

    sendIpcEvent<T = unknown>(): T | Promise<T> {
        return Promise.reject(
            new Error('tv mode requires Electron for portal data access')
        ) as Promise<T>;
    }

    removeAllListeners(): void {
        // No listeners are ever registered without a real Electron bridge.
    }

    listenOn(): void {
        // No listeners are ever registered without a real Electron bridge.
    }

    getAppEnvironment(): string {
        return 'browser';
    }
}
