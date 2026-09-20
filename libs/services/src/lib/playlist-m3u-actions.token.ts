import { InjectionToken } from '@angular/core';
import { Playlist } from '@iptvnator/shared/interfaces';

/**
 * Dispatches M3U playlist NgRx actions on `ElectronService`'s behalf. A
 * callback rather than a direct `@iptvnator/m3u-state` dependency: that lib's
 * own effects already inject `DataService` (this lib's abstract contract),
 * so `libs/services` importing `PlaylistActions` back would create a
 * services ⇄ m3u-state circular dependency (`@nx/enforce-module-boundaries`
 * rejects it outright). Each Electron-capable app (`apps/web`, `apps/tv`)
 * provides this in `app.config.ts` by wrapping `Store.dispatch(PlaylistActions...)`
 * — the same escape-hatch pattern as `CONFIRM_DIALOG_OPENER`.
 */
export interface PlaylistM3uActions {
    handleAddingPlaylistByUrl(payload: {
        isTemporary: boolean;
        playlist: Playlist;
    }): void;
    updatePlaylist(payload: {
        playlist: Playlist;
        playlistId: string;
        refreshEpg?: boolean;
    }): void;
    updateManyPlaylists(payload: { playlists: Playlist[] }): void;
}

export const PLAYLIST_M3U_ACTIONS = new InjectionToken<PlaylistM3uActions>(
    'PLAYLIST_M3U_ACTIONS'
);
