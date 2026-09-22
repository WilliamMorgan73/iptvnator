import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { EpgRuntimeBridgeService } from '@iptvnator/epg/data-access';
import {
    ChannelActions,
    resolveChannelEpgLookupKey,
    selectChannels,
} from '@iptvnator/m3u-state';
import { PlaylistsService, SettingsStore } from '@iptvnator/services';
import {
    epgProviderClockMs,
    type Channel,
    type EpgProgram,
    type PlaylistMeta,
} from '@iptvnator/shared/interfaces';
import { Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';
import type {
    TvLiveCategory,
    TvLiveChannel,
    TvLivePlaybackResult,
    TvLiveSourceAdapter,
} from '@iptvnator/tv/util';
import { currentProgramFieldsOfProgram } from './epg-item-current-program.util';

const ALL_CATEGORY_ID = 'all';
const UNGROUPED_CATEGORY_ID = 'ungrouped';
/** Re-poll the visible category's "now playing" periodically, matching the
 * desktop channel list's own global progress-tick cadence. */
const EPG_REFRESH_INTERVAL_MS = 60_000;

/**
 * M3U has no per-source store — the tv-mode plan's "Data adapters" section
 * has this replicate the 3 lines `M3uWorkspaceRouteSession` uses to load a
 * playlist's channels into `libs/m3u-state`, rather than dispatching
 * `setActiveChannel` (which can auto-launch an external player per user
 * settings — v1's in-app-only player must avoid that). Categories don't
 * exist for M3U; they're grouped client-side from `channel.group.title`,
 * since no such selector exists upstream.
 *
 * EPG: M3U has no provider API, only the locally parsed XMLTV — reuses
 * `EpgRuntimeBridgeService.getCurrentProgramsBatch()` (the same
 * Electron-only, already-guarded batch lookup the desktop app's EPG code
 * uses), keyed by each channel's EPG lookup key
 * (`resolveChannelEpgLookupKey`: tvg-id, falling back to name). The backend
 * already resolves "currently airing", so the result needs no further
 * current-item search — only mapping into `TvLiveChannel`'s fields.
 */
@Injectable({ providedIn: 'root' })
export class M3uTvSourceAdapter implements TvLiveSourceAdapter {
    private readonly store = inject(Store);
    private readonly playlistsService = inject(PlaylistsService);
    private readonly epgBridge = inject(EpgRuntimeBridgeService);
    private readonly settingsStore = inject(SettingsStore);
    private readonly allChannels = toSignal(this.store.select(selectChannels), {
        initialValue: [] as Channel[],
    });
    private readonly selectedCategoryId = signal(ALL_CATEGORY_ID);
    private readonly programsByKey = signal<ReadonlyMap<string, EpgProgram>>(
        new Map()
    );
    private epgRefreshTimer: ReturnType<typeof setInterval> | null = null;
    private epgFetchInFlight = false;

    private readonly categoryNames = computed(() => {
        const names = new Set<string>();
        for (const channel of this.allChannels()) {
            const title = channel.group?.title?.trim();
            if (title) {
                names.add(title);
            }
        }
        return [...names].sort((a, b) => a.localeCompare(b));
    });

    async initialize(playlist: PlaylistMeta): Promise<void> {
        const full = await firstValueFrom(
            this.playlistsService.getPlaylist(playlist._id)
        );
        const channels = (full.playlist?.items ?? []) as Channel[];
        this.store.dispatch(ChannelActions.setChannels({ channels }));
        this.selectedCategoryId.set(ALL_CATEGORY_ID);
        this.startEpgRefresh();
        void this.refreshEpgForCurrentCategory();
    }

    categories(): readonly TvLiveCategory[] {
        const hasUngrouped = this.allChannels().some(
            (channel) => !channel.group?.title?.trim()
        );
        return [
            { id: ALL_CATEGORY_ID, name: 'All' },
            ...this.categoryNames().map((name) => ({ id: name, name })),
            ...(hasUngrouped
                ? [{ id: UNGROUPED_CATEGORY_ID, name: 'Ungrouped' }]
                : []),
        ];
    }

    selectCategory(categoryId: string): void {
        this.selectedCategoryId.set(categoryId);
        void this.refreshEpgForCurrentCategory();
    }

    channels(): readonly TvLiveChannel[] {
        const categoryId = this.selectedCategoryId();
        const programsByKey = this.programsByKey();
        const nowMs = epgProviderClockMs(
            Date.now(),
            this.settingsStore.resolvedEpgOffsetMinutes()
        );
        return this.allChannels()
            .filter((channel) => this.matchesCategory(channel, categoryId))
            .map((channel, index) => {
                const key = resolveChannelEpgLookupKey(channel);
                const program = key ? (programsByKey.get(key) ?? null) : null;
                return {
                    id: channel.id || channel.url || String(index),
                    name: channel.name,
                    categoryId:
                        channel.group?.title?.trim() || UNGROUPED_CATEGORY_ID,
                    sourceKind: 'm3u',
                    logoUrl: channel.tvg?.logo || undefined,
                    playRef: channel,
                    ...currentProgramFieldsOfProgram(program, nowMs),
                };
            });
    }

    private matchesCategory(channel: Channel, categoryId: string): boolean {
        if (categoryId === ALL_CATEGORY_ID) {
            return true;
        }
        const title = channel.group?.title?.trim();
        if (categoryId === UNGROUPED_CATEGORY_ID) {
            return !title;
        }
        return title === categoryId;
    }

    private async refreshEpgForCurrentCategory(): Promise<void> {
        if (this.epgFetchInFlight) {
            return;
        }
        const categoryId = this.selectedCategoryId();
        const keys = [
            ...new Set(
                this.allChannels()
                    .filter((channel) =>
                        this.matchesCategory(channel, categoryId)
                    )
                    .map((channel) => resolveChannelEpgLookupKey(channel))
                    .filter((key): key is string => key.length > 0)
            ),
        ];
        if (keys.length === 0) {
            return;
        }

        this.epgFetchInFlight = true;
        try {
            const nowMs = epgProviderClockMs(
                Date.now(),
                this.settingsStore.resolvedEpgOffsetMinutes()
            );
            const result = await this.epgBridge.getCurrentProgramsBatch(
                keys,
                { nowMs }
            );
            if (!result) {
                return;
            }
            const next = new Map(this.programsByKey());
            for (const key of keys) {
                const program = result[key];
                if (program) {
                    next.set(key, program);
                } else {
                    next.delete(key);
                }
            }
            this.programsByKey.set(next);
        } finally {
            this.epgFetchInFlight = false;
        }
    }

    private startEpgRefresh(): void {
        if (this.epgRefreshTimer !== null) {
            return;
        }
        this.epgRefreshTimer = setInterval(
            () => void this.refreshEpgForCurrentCategory(),
            EPG_REFRESH_INTERVAL_MS
        );
    }

    async resolvePlayback(
        channel: TvLiveChannel
    ): Promise<TvLivePlaybackResult> {
        const item = channel.playRef as Channel;
        return {
            streamUrl: item.url,
            userAgent: item.http?.['user-agent'] || undefined,
            referer: item.http?.referrer || undefined,
            origin: item.http?.origin || undefined,
        };
    }
}
