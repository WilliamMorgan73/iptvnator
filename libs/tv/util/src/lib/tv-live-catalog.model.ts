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

export interface TvLiveChannel {
    readonly id: string;
    readonly name: string;
    readonly categoryId: string;
    readonly sourceKind: TvLiveSourceKind;
    readonly logoUrl?: string;
    /** Provider-assigned channel number, when known (M3U rarely has one). */
    readonly channelNumber?: number;
    /** Opaque per-source reference resolved into a playback URL by the source adapter. */
    readonly playRef: unknown;
    /** Current programme title, when known, for the channel row's second line. */
    readonly currentProgramTitle?: string;
    /** Current programme's elapsed fraction (0–1), for the focused row's progress bar. */
    readonly currentProgramProgress?: number;
}
