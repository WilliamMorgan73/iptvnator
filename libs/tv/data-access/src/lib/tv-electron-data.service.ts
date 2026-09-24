import { Injectable } from '@angular/core';
import { DataService } from '@iptvnator/services';
import {
    CONNECTIVITY_GUARD_RESET,
    PLAYLIST_PARSE_BY_URL,
    STALKER_REQUEST,
    XTREAM_REQUEST,
    XTREAM_RESPONSE,
    type Playlist,
} from '@iptvnator/shared/interfaces';

/**
 * Lean DataService for tv mode: forwards only the IPC actions the real
 * source adapters (and the Add Source screen) actually need — Xtream/Stalker
 * portal requests and M3U-by-URL fetching — straight to the real Electron
 * bridge, the same `window.electron.*` calls `ElectronService.sendIpcEvent`
 * makes. Unlike desktop's `PLAYLIST_UPDATE`/store-dispatching
 * `fetchM3uPlaylistFromUrl`, `PLAYLIST_PARSE_BY_URL` here returns the fetched
 * `Playlist` directly (`window.electron.fetchPlaylistByUrl` only fetches and
 * parses, it does not persist) so the caller can pass it straight to
 * `PlaylistsService.addPlaylist()` itself. No trust-options plumbing
 * (`trustedInsecureTlsHosts`/private-network EPG) — tv v1 exposes no UI for
 * either. Deliberately does NOT replicate `ElectronService`'s MPV/VLC
 * launch or auto-update-playlists paths (v1 has no UI that triggers them) or
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

        if (type === PLAYLIST_PARSE_BY_URL) {
            const { url, title, userAgent } = (payload ?? {}) as Partial<
                Pick<Playlist, 'url' | 'title' | 'userAgent'>
            >;
            if (!url) {
                throw new Error('PLAYLIST_PARSE_BY_URL requires a url');
            }
            return (await window.electron.fetchPlaylistByUrl(url, title, {
                userAgent,
            })) as T;
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
