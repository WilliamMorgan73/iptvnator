import { signal } from '@angular/core';
import { VOLUME_STEP } from '@iptvnator/tv/ui';
import {
    GridFocusController,
    type GridFocusDirection,
    type TvLiveCategory,
    type TvLiveSource,
    type TvSettingsItem,
} from '@iptvnator/tv/util';

export type TvLivePane = 'sources' | 'pills' | 'channels' | 'settings';

export interface TvLivePanesConfig {
    categories(): readonly TvLiveCategory[];
    sources(): readonly TvLiveSource[];
    settingsItems(): readonly TvSettingsItem[];
    activePlaylistId(): string | null;
    /** Columns the channels grid currently has — 1 in list mode. */
    channelColumns(): number;
    channelCount(): number;
    /** Index of the actively playing channel within the current channel
     * list, or null if nothing has been activated yet (e.g. Escape pressed
     * before ever picking a channel). Drives immersive channel-stepping. */
    activeChannelIndex(): number | null;
    idleTimeoutMs(): number;

    onCategorySelected(categoryId: string): void;
    selectPlaylist(sourceId: string): Promise<void>;
    adjustSetting(itemId: TvSettingsItem['id'], direction: 'left' | 'right'): void;
    onChannelActivated(index: number): void;
    adjustVolume(delta: number): void;
    togglePlayPause(): void;
    dismissInfoOverlay(): void;
}

/**
 * Owns everything about "which of the four panes (pills/channels/sources/
 * settings) is active, and what an input event does" — the branching that
 * used to live directly on `TvLiveScreenComponent` before Milestone 8 pushed
 * it over the file's line budget. A plain, DI-free class (like
 * `TvPlaybackController`/`GridFocusController`), independently testable with
 * a fake `TvLivePanesConfig`; the shell supplies the real one bound to
 * `TvLiveCatalogFacade`/`SettingsStore`/`TvPlaybackController`.
 *
 * Playback itself, the info-overlay's own visibility/content, and catalog
 * lifecycle (bootstrap, channel activation's `playNow`) stay on the shell —
 * this class only decides pane/focus state and calls back into the shell
 * for the side effects it doesn't own.
 */
export class TvLivePanesController {
    readonly activePane = signal<TvLivePane>('channels');
    readonly panelVisible = signal(true);
    readonly selectedCategoryId = signal<string | null>(null);
    /** The pane `onBack()`/a second `toggleSources`/`toggleSettings` press
     * returns to. */
    private panelBeforeOverlay: TvLivePane = 'channels';
    private idleTimeoutId: ReturnType<typeof setTimeout> | null = null;

    // List mode: a single horizontal row (left/right move, up/down no-op).
    // Grid mode: a vertical rail beside the tile grid (up/down move,
    // left/right no-op) — see isGridMode below.
    readonly pillsController = new GridFocusController({
        itemCount: () => this.config.categories().length,
        columnCount: () =>
            this.isGridMode ? 1 : this.config.categories().length,
    });

    readonly channelsController = new GridFocusController({
        itemCount: () => this.config.channelCount(),
        columnCount: () => this.config.channelColumns(),
    });

    readonly sourcesController = new GridFocusController({
        itemCount: () => this.config.sources().length,
        columnCount: () => 1, // vertical list: up/down move, left/right no-op
    });

    // columnCount: 1 makes the controller itself no-op left/right, but
    // onDirection() intercepts left/right before forwarding here — a
    // settings row is adjusted in place, not activated.
    readonly settingsController = new GridFocusController({
        itemCount: () => this.config.settingsItems().length,
        columnCount: () => 1,
    });

    constructor(private readonly config: TvLivePanesConfig) {
        this.resetIdleTimer();
    }

    destroy(): void {
        if (this.idleTimeoutId !== null) {
            clearTimeout(this.idleTimeoutId);
        }
    }

    onDirection(direction: GridFocusDirection): void {
        this.config.dismissInfoOverlay();
        if (!this.panelVisible()) {
            this.handleImmersiveDirection(direction);
            return;
        }
        this.wake();
        if (this.activePane() === 'sources') {
            this.sourcesController.move(direction);
            return;
        }
        if (this.activePane() === 'settings') {
            if (direction === 'left' || direction === 'right') {
                this.adjustFocusedSetting(direction);
                return;
            }
            this.settingsController.move(direction);
            return;
        }
        if (this.activePane() === 'pills') {
            if (direction === this.enterChannelsDirection) {
                this.activePane.set('channels');
                return;
            }
            this.pillsController.move(direction);
            return;
        }
        const focusedIndex = this.channelsController.focusedIndex();
        const columns = this.config.channelColumns();
        // List mode hands off on Up from the first ROW (columns===1, so
        // this is just index 0); grid mode hands off on Left from the first
        // COLUMN of any row — two different boundaries, since the category
        // rail sits above the list but beside the grid.
        const atHandoffBoundary =
            focusedIndex !== null &&
            (this.isGridMode ? focusedIndex % columns === 0 : focusedIndex < columns);
        if (direction === this.exitChannelsDirection && atHandoffBoundary) {
            this.activePane.set('pills');
            return;
        }
        this.channelsController.move(direction);
    }

    /** Grid mode's category rail sits beside the tile grid, not above it —
     * the pane hand-off direction flips from "up/down" to "left/right". */
    private get isGridMode(): boolean {
        return this.config.channelColumns() > 1;
    }

    private get enterChannelsDirection(): GridFocusDirection {
        return this.isGridMode ? 'right' : 'down';
    }

    private get exitChannelsDirection(): GridFocusDirection {
        return this.isGridMode ? 'left' : 'up';
    }

    /** While immersive, arrows control playback instead of navigating — only
     * Left reveals the panel, matching the mockup's "Press left for
     * channels" hint. */
    private handleImmersiveDirection(direction: GridFocusDirection): void {
        if (direction === 'left') {
            this.wake();
            return;
        }
        if (direction === 'up') {
            this.config.adjustVolume(VOLUME_STEP);
            return;
        }
        if (direction === 'down') {
            this.config.adjustVolume(-VOLUME_STEP);
        }
        // 'right': deliberate no-op, matching the mockup's restraint.
    }

    onActivate(): void {
        this.config.dismissInfoOverlay();
        if (!this.panelVisible()) {
            this.config.togglePlayPause();
            return;
        }
        this.wake();
        if (this.activePane() === 'sources') {
            this.sourcesController.activate((index) => void this.selectSource(index));
            return;
        }
        if (this.activePane() === 'settings') {
            // Left/Right adjusts a row's value; there is nothing to confirm.
            return;
        }
        if (this.activePane() === 'pills') {
            this.pillsController.activate((index) => this.selectCategory(index));
        } else {
            this.channelsController.activate((index) =>
                this.config.onChannelActivated(index)
            );
        }
    }

    onBack(): void {
        this.config.dismissInfoOverlay();
        if (!this.panelVisible()) {
            this.wake();
            return;
        }
        if (this.activePane() === 'sources' || this.activePane() === 'settings') {
            this.activePane.set(this.panelBeforeOverlay);
            return;
        }
        // No parent screen to leave in v1: Escape just collapses to immersive.
        this.collapseToImmersive();
    }

    /** Gamepad Back/Select (or keyboard Tab): opens/closes the source-switcher pane. */
    onToggleSources(): void {
        if (!this.panelVisible()) {
            this.wake();
            return;
        }
        this.wake();
        if (this.activePane() === 'sources') {
            this.activePane.set(this.panelBeforeOverlay);
            return;
        }
        this.panelBeforeOverlay = this.activePane();
        const sources = this.config.sources();
        const activeIndex = sources.findIndex(
            (source) => source.id === this.config.activePlaylistId()
        );
        this.sourcesController.focusedIndex.set(
            sources.length > 0 ? Math.max(0, activeIndex) : null
        );
        this.activePane.set('sources');
    }

    /** Gamepad Start (or keyboard `KeyS`): opens settings directly in one
     * press, from immersive or from any other pane — unlike
     * `onToggleSources()`, this one doesn't spend a press just waking the
     * panel. Only a second press while already on the settings pane closes
     * it back to whatever was active before. */
    onToggleSettings(): void {
        const wasImmersive = !this.panelVisible();
        this.wake();
        if (!wasImmersive && this.activePane() === 'settings') {
            this.activePane.set(this.panelBeforeOverlay);
            return;
        }
        this.panelBeforeOverlay = this.activePane();
        this.settingsController.focusedIndex.set(0);
        this.activePane.set('settings');
    }

    /** Gamepad LB/RB (or PageUp/PageDown): flips category directly, skipping
     * the pills pane — or, while immersive, steps the playing channel
     * instead, since there is no pills pane to speak of on the video-only
     * screen. Same physical buttons, mode-dependent meaning, same pattern
     * `handleImmersiveDirection` already uses for Up/Down. */
    onCategoryStep(direction: 'previous' | 'next'): void {
        if (!this.panelVisible()) {
            this.stepImmersiveChannel(direction);
            return;
        }
        this.wake();
        const categories = this.config.categories();
        const currentIndex = categories.findIndex(
            (category) => category.id === this.selectedCategoryId()
        );
        const nextIndex = currentIndex + (direction === 'next' ? 1 : -1);
        if (nextIndex < 0 || nextIndex >= categories.length) {
            return; // No-op at the boundary, same rule as GridFocusController.
        }
        this.selectCategory(nextIndex);
    }

    /** Switches the playing channel without revealing the panel — keeps
     * `channelsController.focusedIndex` in sync so revealing the panel
     * afterward (Left) shows the right row/tile highlighted. No-ops at the
     * boundary or when nothing has played yet, same rule as everywhere
     * else in this controller. */
    private stepImmersiveChannel(direction: 'previous' | 'next'): void {
        const index = this.config.activeChannelIndex();
        if (index === null) {
            return;
        }
        const nextIndex = index + (direction === 'next' ? 1 : -1);
        if (nextIndex < 0 || nextIndex >= this.config.channelCount()) {
            return;
        }
        this.channelsController.focusedIndex.set(nextIndex);
        this.config.onChannelActivated(nextIndex);
    }

    /** Public so the shell can drive it after catalog bootstrap / a source
     * switch resolves — both just want "select the first category." */
    selectCategory(index: number): void {
        const category = this.config.categories()[index];
        if (!category) {
            return;
        }
        this.config.onCategorySelected(category.id);
        this.selectedCategoryId.set(category.id);
        this.pillsController.focusedIndex.set(index);
        this.channelsController.focusedIndex.set(0);
        this.activePane.set('channels');
    }

    /** Public so the shell can call it once at startup with no fallback pane
     * to fall back to. */
    collapseToImmersive(): void {
        this.panelVisible.set(false);
        if (this.idleTimeoutId !== null) {
            clearTimeout(this.idleTimeoutId);
            this.idleTimeoutId = null;
        }
    }

    private async selectSource(index: number): Promise<void> {
        const source = this.config.sources()[index];
        if (!source) {
            return;
        }
        await this.config.selectPlaylist(source.id);
        const categories = this.config.categories();
        if (categories.length === 0) {
            this.activePane.set('pills');
            return;
        }
        this.selectCategory(0);
    }

    /** Left/Right on a focused settings row — adjusts and saves immediately,
     * no separate confirm step (every included setting already applies live
     * with no restart, see the Milestone 7 scope note). */
    private adjustFocusedSetting(direction: 'left' | 'right'): void {
        const index = this.settingsController.focusedIndex();
        const item = index !== null ? this.config.settingsItems()[index] : undefined;
        if (!item) {
            return;
        }
        this.config.adjustSetting(item.id, direction);
    }

    /** Redisplays the panel and resets the idle timer. */
    private wake(): void {
        this.panelVisible.set(true);
        this.resetIdleTimer();
    }

    private resetIdleTimer(): void {
        if (this.idleTimeoutId !== null) {
            clearTimeout(this.idleTimeoutId);
        }
        this.idleTimeoutId = setTimeout(
            () => this.panelVisible.set(false),
            this.config.idleTimeoutMs()
        );
    }
}
