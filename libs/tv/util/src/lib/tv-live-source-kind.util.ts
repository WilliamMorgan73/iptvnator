import {
    isStalkerAccountPlaylist,
    isXtreamAccountPlaylist,
    type PlaylistMeta,
} from '@iptvnator/shared/interfaces';
import type { TvLiveSourceKind } from './tv-live-catalog.model';

/**
 * Same structural predicates the rest of the app uses to tell playlist kinds
 * apart (`isXtreamAccountPlaylist`/`isStalkerAccountPlaylist` — there is no
 * `type` discriminator field on `Playlist`). Anything that is neither is
 * treated as M3U, the only other kind tv mode supports.
 */
export function resolveTvLiveSourceKind(
    playlist: PlaylistMeta
): TvLiveSourceKind {
    if (isXtreamAccountPlaylist(playlist)) {
        return 'xtream';
    }
    if (isStalkerAccountPlaylist(playlist)) {
        return 'stalker';
    }
    return 'm3u';
}
