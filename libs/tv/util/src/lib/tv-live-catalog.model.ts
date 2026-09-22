import type { TvCurrentProgramFields } from './tv-epg-progress.util';

/**
 * The unified shape the whole tv-mode UI layer works with, so it never needs
 * to know which portal type (Xtream/Stalker/M3U) a category or channel came
 * from. Real adapters (Milestone 3) map each source's own API/store shapes
 * onto these; Milestone 1 fixtures construct them directly.
 */
export interface TvLiveCategory {
    readonly id: string;
    readonly name: string;
}

export type TvLiveSourceKind = 'xtream' | 'stalker' | 'm3u';

/** One entry in the source-switcher panel — a playlist plus its resolved kind. */
export interface TvLiveSource {
    readonly id: string;
    readonly title: string;
    readonly kind: TvLiveSourceKind;
}

export interface TvLiveChannel extends TvCurrentProgramFields {
    readonly id: string;
    readonly name: string;
    readonly categoryId: string;
    readonly sourceKind: TvLiveSourceKind;
    readonly logoUrl?: string;
    /** Provider-assigned channel number, when known (M3U rarely has one). */
    readonly channelNumber?: number;
    /** Opaque per-source reference resolved into a playback URL by the source adapter. */
    readonly playRef: unknown;
}
