import { Injectable } from '@angular/core';
import { DataService } from '@iptvnator/services';
import {
    CONNECTIVITY_GUARD_RESET,
    STALKER_REQUEST,
    XTREAM_REQUEST,
    XTREAM_RESPONSE,
} from '@iptvnator/shared/interfaces';

/**
 * Lean DataService for tv mode: forwards only the IPC actions the real
 * source adapters actually need (Xtream/Stalker portal requests) straight to
 * the real Electron bridge — the same `window.electron.xtreamRequest`/
 * `stalkerRequest` calls `ElectronService.sendIpcEvent` makes. Deliberately
 * does NOT replicate `ElectronService`'s MPV/VLC launch, M3U-by-URL import,
 * or auto-update-playlists paths (v1 has no UI that triggers any of them) or
 * its per-failure snackbar (tv mode has no toast UI to show one in) —
 * reusing `ElectronService` itself would pull in `MatSnackBar`,
 * `TranslateService`, `SettingsStore`, and `SourceActivityService` for
 * features this screen cannot use yet.
 */
@Injectable({ providedIn: 'root' })
export class TvElectronDataService extends DataService {
    getAppVersion(): string {
        return '0.0.0';
    }

    async sendIpcEvent<T = unknown>(
        type: string,
        payload?: unknown
    ): Promise<T> {
        if (type === XTREAM_REQUEST) {
            const response = await window.electron.xtreamRequest(
                payload as Parameters<
                    typeof window.electron.xtreamRequest
                >[0]
            );
            return {
                type: XTREAM_RESPONSE,
                payload: response.payload,
                action: response.action,
            } as T;
        }

        if (type === STALKER_REQUEST) {
            return (await window.electron.stalkerRequest(
                payload as Parameters<
                    typeof window.electron.stalkerRequest
                >[0]
            )) as T;
        }

        if (type === CONNECTIVITY_GUARD_RESET) {
            const { url } = (payload as { url?: string }) ?? {};
            if (url) {
                await window.electron.resetHostConnectivityGuard(url);
            }
            return undefined as T;
        }

        console.warn('[tv] Unhandled IPC event type:', type);
        return undefined as T;
    }

    removeAllListeners(): void {
        // tv mode never registers push-event listeners in v1.
    }

    listenOn(): void {
        // tv mode never registers push-event listeners in v1.
    }

    getAppEnvironment(): string {
        return 'electron';
    }
}
