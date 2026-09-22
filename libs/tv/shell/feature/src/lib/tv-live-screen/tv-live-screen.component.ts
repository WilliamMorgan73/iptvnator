import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ElectronStreamHeadersService } from '@iptvnator/ui/playback/electron-stream-headers';
import { GamepadInputService, TvLiveCatalogFacade } from '@iptvnator/tv/data-access';
import {
    TvCategoryPillsComponent,
    TvChannelInfoOverlayComponent,
    TvChannelListComponent,
    TvImmersiveHintComponent,
    TvKeyboardInputDirective,
    TvLiveClockBadgeComponent,
    TvPlaybackController,
    TvPlaybackHudComponent,
    TvSourcePanelComponent,
    VOLUME_STEP,
} from '@iptvnator/tv/ui';
import {
    GridFocusController,
    GridFocusDirection,
    type TvLiveChannel,
} from '@iptvnator/tv/util';

const IDLE_TIMEOUT_MS = 5000;
/** Longer than the volume/play-pause HUD's ~1.5s — there's more to read. */
const INFO_OVERLAY_TIMEOUT_MS = 6000;

type TvLivePane = 'sources' | 'pills' | 'channels';

/**
 * The one screen of v1: a translucent browsing panel over a full-bleed
 * video backdrop, and an immersive state once the panel auto-hides. Owns
 * all three GridFocusController instances and decides which pane is
 * "active" — see the tv-mode plan's "Focus/navigation engine" section for
 * why that handoff isn't the controller's own job. Categories/channels come
 * from TvLiveCatalogFacade, which activates the first available playlist on
 * startup; the source-switcher pane (toggled by `onToggleSources()`)
 * temporarily replaces the pills+channel-list content to let the user pick
 * a different one. Playback (video engine, preview-swap, volume/play-pause
 * HUD) is owned by TvPlaybackController; while immersive, Up/Down control
 * volume and Enter toggles play/pause instead of navigating — Left
 * (matching the mockup's "Press left for channels" hint) is the one
 * direction that still reveals the panel.
 */
@Component({
    selector: 'app-tv-live-screen',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        RouterLink,
        TvCategoryPillsComponent,
        TvChannelInfoOverlayComponent,
        TvChannelListComponent,
        TvImmersiveHintComponent,
        TvKeyboardInputDirective,
        TvLiveClockBadgeComponent,
        TvPlaybackHudComponent,
        TvSourcePanelComponent,
    ],
    templateUrl: './tv-live-screen.component.html',
    styleUrls: ['./tv-live-screen.component.scss'],
})
export class TvLiveScreenComponent {
    private readonly destroyRef = inject(DestroyRef);
    private readonly gamepadInput = inject(GamepadInputService);
    private readonly catalog = inject(TvLiveCatalogFacade);
    private readonly electronStreamHeaders = inject(ElectronStreamHeadersService);
    private readonly videoRef =
        viewChild<ElementRef<HTMLVideoElement>>('video');
    private idleTimeoutId: ReturnType<typeof setTimeout> | null = null;
    private infoOverlayTimeoutId: ReturnType<typeof setTimeout> | null = null;

    readonly status = this.catalog.status;
    readonly playlistTitle = this.catalog.playlistTitle;
    readonly activePlaylistId = this.catalog.activePlaylistId;

    readonly categories = computed(() => this.catalog.categories());
    readonly channels = computed(() => this.catalog.channels());
    readonly sources = computed(() => this.catalog.sources());

    readonly selectedCategoryId = signal<string | null>(null);
    readonly activePane = signal<TvLivePane>('channels');
    /** The pane `onBack()`/a second `toggleSources` press returns to. */
    private panelBeforeSources: TvLivePane = 'channels';
    readonly panelVisible = signal(true);
    readonly activeChannelId = signal<string | null>(null);
    readonly clock = signal(this.formatClock());
    readonly infoOverlayVisible = signal(false);

    /**
     * Channel the info overlay describes — the focused row while the panel
     * is open on the channels pane, otherwise the actively playing channel
     * (covers immersive playback, and the pills/sources panes where nothing
     * is "focused" in the channel-row sense).
     */
    readonly infoOverlayChannel = computed<TvLiveChannel | null>(() => {
        if (this.panelVisible() && this.activePane() === 'channels') {
            const index = this.channelsController.focusedIndex();
            return index !== null ? (this.channels()[index] ?? null) : null;
        }
        const activeId = this.activeChannelId();
        return (
            this.channels().find((channel) => channel.id === activeId) ??
            null
        );
    });

    readonly playback = new TvPlaybackController({
        resolvePlayback: (channel) => this.catalog.resolvePlayback(channel),
        applyHeaders: (playback, title) =>
            this.electronStreamHeaders.apply({ ...playback, title }),
    });

    readonly pillsController = new GridFocusController({
        itemCount: () => this.categories().length,
        columnCount: () => this.categories().length, // single row: left/right move, up/down no-op
    });

    readonly channelsController = new GridFocusController({
        itemCount: () => this.channels().length,
        columnCount: () => 1, // vertical list: up/down move, left/right no-op
    });

    readonly sourcesController = new GridFocusController({
        itemCount: () => this.sources().length,
        columnCount: () => 1, // vertical list: up/down move, left/right no-op
    });

    constructor() {
        this.resetIdleTimer();

        const clockIntervalId = setInterval(
            () => this.clock.set(this.formatClock()),
            30_000
        );
        this.destroyRef.onDestroy(() => {
            clearInterval(clockIntervalId);
            if (this.idleTimeoutId !== null) {
                clearTimeout(this.idleTimeoutId);
            }
            if (this.infoOverlayTimeoutId !== null) {
                clearTimeout(this.infoOverlayTimeoutId);
            }
            this.playback.destroy();
        });

        // Attaches once the <video> element first renders and stays attached
        // for the component's lifetime — the element is always present in
        // the template (the video plays full-bleed regardless of panel/
        // immersive state), so this never needs to re-run.
        effect(() => {
            const element = this.videoRef()?.nativeElement;
            if (element) {
                this.playback.attach(element);
            }
        });

        // Follows the focused channel — category switch, up/down navigation,
        // and the adapter's own async refetch resolving all flow through
        // channels()/focusedIndex(), so one effect covers every case the
        // plan's "swap the preview as you move the highlight" note describes.
        effect(() => {
            const channel =
                this.channels()[this.channelsController.focusedIndex() ?? -1];
            this.playback.schedulePreview(channel);
        });

        this.gamepadInput.actions$
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((action) => {
                switch (action.kind) {
                    case 'direction':
                        this.onDirection(action.direction);
                        break;
                    case 'activate':
                        this.onActivate();
                        break;
                    case 'back':
                        this.onBack();
                        break;
                    case 'categoryStep':
                        this.onCategoryStep(action.direction);
                        break;
                    case 'toggleSources':
                        this.onToggleSources();
                        break;
                    case 'toggleInfo':
                        this.onToggleInfo();
                        break;
                }
            });

        void this.bootstrap();
    }

    onDirection(direction: GridFocusDirection): void {
        this.dismissInfoOverlay();
        if (!this.panelVisible()) {
            this.handleImmersiveDirection(direction);
            return;
        }
        this.wake();
        if (this.activePane() === 'sources') {
            this.sourcesController.move(direction);
            return;
        }
        if (this.activePane() === 'pills') {
            if (direction === 'down') {
                this.activePane.set('channels');
                return;
            }
            this.pillsController.move(direction);
            return;
        }
        if (direction === 'up' && this.channelsController.focusedIndex() === 0) {
            this.activePane.set('pills');
            return;
        }
        this.channelsController.move(direction);
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
            this.playback.adjustVolume(VOLUME_STEP);
            return;
        }
        if (direction === 'down') {
            this.playback.adjustVolume(-VOLUME_STEP);
        }
        // 'right': deliberate no-op, matching the mockup's restraint.
    }

    onActivate(): void {
        this.dismissInfoOverlay();
        if (!this.panelVisible()) {
            this.playback.togglePlayPause();
            return;
        }
        this.wake();
        if (this.activePane() === 'sources') {
            this.sourcesController.activate(
                (index) => void this.selectSource(index)
            );
            return;
        }
        if (this.activePane() === 'pills') {
            this.pillsController.activate((index) => this.selectCategory(index));
        } else {
            this.channelsController.activate((index) => void this.playChannel(index));
        }
    }

    onBack(): void {
        this.dismissInfoOverlay();
        if (!this.panelVisible()) {
            this.wake();
            return;
        }
        if (this.activePane() === 'sources') {
            this.activePane.set(this.panelBeforeSources);
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
            this.activePane.set(this.panelBeforeSources);
            return;
        }
        this.panelBeforeSources = this.activePane();
        const sources = this.sources();
        const activeIndex = sources.findIndex(
            (source) => source.id === this.activePlaylistId()
        );
        this.sourcesController.focusedIndex.set(
            sources.length > 0 ? Math.max(0, activeIndex) : null
        );
        this.activePane.set('sources');
    }

    /**
     * Gamepad Y (or keyboard `KeyI`): shows the channel-info overlay for
     * `infoOverlayChannel()`. Deliberately does not `wake()`/reveal the
     * panel — pressing Info during immersive playback should work without
     * first bringing back the channel list, matching the plan's restraint.
     */
    onToggleInfo(): void {
        this.revealInfoOverlay();
    }

    /** Shared by `onToggleInfo()` and `playChannel()` — activating a channel
     * shows the same overlay automatically, so the two never drift apart. */
    private revealInfoOverlay(): void {
        const channel = this.infoOverlayChannel();
        if (!channel) {
            return;
        }
        this.infoOverlayVisible.set(true);
        if (this.infoOverlayTimeoutId !== null) {
            clearTimeout(this.infoOverlayTimeoutId);
        }
        this.infoOverlayTimeoutId = setTimeout(
            () => this.infoOverlayVisible.set(false),
            INFO_OVERLAY_TIMEOUT_MS
        );
    }

    private dismissInfoOverlay(): void {
        if (!this.infoOverlayVisible()) {
            return;
        }
        this.infoOverlayVisible.set(false);
        if (this.infoOverlayTimeoutId !== null) {
            clearTimeout(this.infoOverlayTimeoutId);
            this.infoOverlayTimeoutId = null;
        }
    }

    /** Gamepad LB/RB (or PageUp/PageDown): flips category directly, skipping the pills pane. */
    onCategoryStep(direction: 'previous' | 'next'): void {
        if (!this.panelVisible()) {
            this.wake();
            return;
        }
        this.wake();
        const categories = this.categories();
        const currentIndex = categories.findIndex(
            (category) => category.id === this.selectedCategoryId()
        );
        const nextIndex = currentIndex + (direction === 'next' ? 1 : -1);
        if (nextIndex < 0 || nextIndex >= categories.length) {
            return; // No-op at the boundary, same rule as GridFocusController.
        }
        this.selectCategory(nextIndex);
    }

    private async selectSource(index: number): Promise<void> {
        const source = this.sources()[index];
        if (!source) {
            return;
        }
        await this.catalog.selectPlaylist(source.id);
        const categories = this.categories();
        if (categories.length === 0) {
            this.activePane.set('pills');
            return;
        }
        this.selectCategory(0);
    }

    private async bootstrap(): Promise<void> {
        await this.catalog.initialize();
        if (this.catalog.status() !== 'ready') {
            return;
        }
        const categories = this.categories();
        if (categories.length === 0) {
            return;
        }
        this.selectCategory(0);
    }

    private selectCategory(index: number): void {
        const category = this.categories()[index];
        this.catalog.selectCategory(category.id);
        this.selectedCategoryId.set(category.id);
        this.pillsController.focusedIndex.set(index);
        this.channelsController.focusedIndex.set(0);
        this.activePane.set('channels');
    }

    private async playChannel(index: number): Promise<void> {
        const channel = this.channels()[index];
        this.activeChannelId.set(channel.id);
        this.collapseToImmersive();
        // Same temporary overlay as the manual Info action — confirming a
        // channel into fullscreen should announce what just started playing
        // without requiring a second button press.
        this.revealInfoOverlay();
        await this.playback.playNow(channel);
    }

    private collapseToImmersive(): void {
        this.panelVisible.set(false);
        if (this.idleTimeoutId !== null) {
            clearTimeout(this.idleTimeoutId);
            this.idleTimeoutId = null;
        }
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
            IDLE_TIMEOUT_MS
        );
    }

    private formatClock(): string {
        return new Date().toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
        });
    }
}
