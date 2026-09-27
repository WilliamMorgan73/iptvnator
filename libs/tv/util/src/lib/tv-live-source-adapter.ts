import type { PlaylistMeta } from '@iptvnator/shared/interfaces';
import type { TvLiveCategory, TvLiveChannel } from './tv-live-catalog.model';

/** Enough to build a `<video>` source; matches `ResolvedPortalPlayback`'s shape. */
export interface TvLivePlaybackResult {
    readonly streamUrl: string;
    readonly userAgent?: string;
    readonly referer?: string;
    readonly origin?: string;
    readonly headers?: Readonly<Record<string, string>>;
}

/**
 * One per source type (Xtream/Stalker/M3U), each a thin wrapper over an
 * already-existing, verified store/service — see the tv-mode plan's "Data
 * adapters" section. `categories()` always includes an "All" entry first
 * (native for Stalker's `'*'`, synthesized for Xtream/M3U) so the shell never
 * needs source-specific logic. `selectCategory` is a command (mirrors the
 * real stores' own `setSelectedCategory`); `channels()` reads whatever is
 * currently selected — kept as two steps, not one "channels for category"
 * call, so a reactive read never has a mutating side effect baked into it.
 */
export interface TvLiveSourceAdapter {
    initialize(playlist: PlaylistMeta): Promise<void>;
    categories(): readonly TvLiveCategory[];
    selectCategory(categoryId: string): void;
    channels(): readonly TvLiveChannel[];
    resolvePlayback(channel: TvLiveChannel): Promise<TvLivePlaybackResult>;
    /**
     * The whole active source's channels, across every category — numeric
     * channel entry searches this, not `channels()`, since a typed number
     * should find a channel wherever it lives. Optional: best-effort where a
     * source has no cheap way to get a full list without disturbing the
     * currently selected category (e.g. Stalker before its background full-
     * list cache has finished loading); falls back to `channels()` when
     * absent. Never has a mutating side effect, same rule as `channels()`.
     */
    channelsAcrossCategories?(): readonly TvLiveChannel[];
    /**
     * Records a confirmed activation (not a preview-on-focus) to whichever
     * recently-viewed storage this source type already has. Optional so
     * existing test fixtures aren't forced to implement it; the facade
     * no-ops when absent.
     */
    recordRecentlyViewed?(channel: TvLiveChannel): void;
    /** Recently (confirmed-)played channels for the active source, most-
     * recent-first. Optional for the same reason as `recordRecentlyViewed`. */
    recentChannels?(): readonly TvLiveChannel[];
}
