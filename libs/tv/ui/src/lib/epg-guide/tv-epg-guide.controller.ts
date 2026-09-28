import { signal } from '@angular/core';
import { getTodayEpgDateKey, shiftEpgDateKey, parseEpgDateKey } from '@iptvnator/ui/epg';
import type { EpgProgram } from '@iptvnator/shared/interfaces';
import {
    TvEpgGuideFocusController,
    type TvEpgGuideAdapter,
    type TvEpgGuideChannel,
} from '@iptvnator/tv/util';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Reorders/filters the adapter's full channel list down to `ids`, in `ids`'
 * own order (the category pane's order) — a channel absent from the guide
 * adapter (shouldn't happen; both read from the same source) is skipped
 * rather than producing a hole. */
function filterGuideChannelsByIds(
    channels: readonly TvEpgGuideChannel[],
    ids: readonly string[]
): readonly TvEpgGuideChannel[] {
    const byId = new Map(channels.map((channel) => [channel.id, channel]));
    return ids
        .map((id) => byId.get(id))
        .filter((channel): channel is TvEpgGuideChannel => channel !== undefined);
}

export interface TvEpgGuideControllerConfig {
    /** The active source's guide adapter, read fresh on every call — mirrors
     * `TvDigitEntryConfig.channels()`'s "always ask the facade" pattern,
     * since the active source can change while the guide is closed. */
    adapter(): TvEpgGuideAdapter | null;
}

/**
 * Owns the guide's day window, programme fetch, and 2D focus — the shell
 * calls `open()`/`close()` around the 'guide' pane's own open/close toggle.
 * DI-free, same shape as `TvPlaybackController`/`TvDigitEntryController`.
 * Deliberately reuses `getTodayEpgDateKey()`/`shiftEpgDateKey()`/
 * `parseEpgDateKey()` from `@iptvnator/ui/epg` (pure date-key helpers, no
 * Angular/DOM dependency) rather than re-deriving day-boundary math — the
 * one piece of desktop's guide genuinely worth sharing here.
 */
export class TvEpgGuideController {
    readonly channels = signal<readonly TvEpgGuideChannel[]>([]);
    readonly programsByChannelId = signal<ReadonlyMap<string, EpgProgram[]>>(
        new Map()
    );
    readonly dateKey = signal(getTodayEpgDateKey());
    readonly loading = signal(false);

    readonly focus = new TvEpgGuideFocusController({
        rowCount: () => this.channels().length,
        blockCount: (row) =>
            this.programsByChannelId().get(this.channels()[row]?.id ?? '')
                ?.length ?? 0,
    });

    private requestId = 0;

    constructor(private readonly config: TvEpgGuideControllerConfig) {}

    /** Opens on today, focused on the active channel's row when it's in the
     * guide's channel list, else the first row. `categoryChannelIds`, when
     * given, narrows the adapter's full cross-category list down to the
     * category the shell had selected when Guide was pressed (in that
     * category's own order) — the guide otherwise shows the whole source,
     * which for a large provider is far more channels than fit or matter at
     * once. Passing null/undefined keeps the full list. */
    open(
        activeChannelId: string | null,
        categoryChannelIds?: readonly string[] | null
    ): void {
        this.dateKey.set(getTodayEpgDateKey());
        const allChannels = this.config.adapter()?.channels() ?? [];
        const channels = categoryChannelIds
            ? filterGuideChannelsByIds(allChannels, categoryChannelIds)
            : allChannels;
        this.channels.set(channels);
        const activeIndex =
            activeChannelId !== null
                ? channels.findIndex((channel) => channel.id === activeChannelId)
                : -1;
        this.focus.focus.set(
            channels.length > 0
                ? { row: activeIndex >= 0 ? activeIndex : 0, block: null }
                : null
        );
        void this.refresh();
    }

    close(): void {
        this.focus.reset();
    }

    /** Gamepad LB/RB (or PageUp/PageDown) while the guide pane is open —
     * same physical gesture `TvLivePanesController.onCategoryStep()` already
     * uses for category flipping, reused here for day stepping. */
    stepDay(direction: 'previous' | 'next'): void {
        this.dateKey.update((key) =>
            shiftEpgDateKey(key, direction === 'next' ? 'next' : 'prev')
        );
        void this.refresh();
    }

    focusedChannel(): TvEpgGuideChannel | null {
        const row = this.focus.focus()?.row;
        return row !== undefined ? (this.channels()[row] ?? null) : null;
    }

    private async refresh(): Promise<void> {
        const requestId = ++this.requestId;
        const adapter = this.config.adapter();
        const channels = this.channels();
        if (!adapter || channels.length === 0) {
            this.programsByChannelId.set(new Map());
            return;
        }
        const dayStartMs = parseEpgDateKey(this.dateKey()).getTime();
        this.loading.set(true);
        try {
            const programs = await adapter.loadPrograms({
                channelIds: channels.map((channel) => channel.id),
                fromMs: dayStartMs,
                toMs: dayStartMs + ONE_DAY_MS,
            });
            // A faster later request (rapid PageUp/PageDown) must not be
            // clobbered by a slower earlier one resolving after it.
            if (requestId === this.requestId) {
                this.programsByChannelId.set(programs);
            }
        } finally {
            if (requestId === this.requestId) {
                this.loading.set(false);
            }
        }
    }
}
