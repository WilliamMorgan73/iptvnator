import type { EpgProgram } from '@iptvnator/shared/interfaces';

/** One row of the tv-mode programme guide. `id` matches the corresponding
 * `TvLiveChannel.id` directly — unlike desktop's guide, tv mode never lists
 * the same channel twice (its channel lists come straight from
 * `channelsAcrossCategories()`), so no separate scope-local row-id scheme is
 * needed. */
export interface TvEpgGuideChannel {
    readonly id: string;
    readonly number: number;
    readonly name: string;
    readonly logoUrl: string | null;
}

/** A request window. Instants are epoch ms in the provider's own EPG clock —
 * same convention as `epgProviderClockMs()` elsewhere in tv mode. */
export interface TvEpgGuideWindow {
    readonly channelIds: readonly string[];
    readonly fromMs: number;
    readonly toMs: number;
}

/**
 * One per source type (Xtream/Stalker/M3U) — the guide's counterpart to
 * `TvLiveSourceAdapter`. Deliberately narrower than desktop's
 * `EpgGuideSource`: no scopes/favorites (the guide reuses the existing
 * category pane for that), no search, no catch-up, and no `activate()` — the
 * shell already knows how to activate any `TvLiveChannel` cross-category
 * (`activateChannelFromAnywhere()`), so the guide just resolves the focused
 * row back to one via `TvLiveCatalogFacade.channelsAcrossCategories()`
 * rather than duplicating that logic here.
 */
export interface TvEpgGuideAdapter {
    channels(): readonly TvEpgGuideChannel[];
    /** Programmes overlapping the window, keyed by `TvEpgGuideChannel.id`. */
    loadPrograms(window: TvEpgGuideWindow): Promise<Map<string, EpgProgram[]>>;
}
