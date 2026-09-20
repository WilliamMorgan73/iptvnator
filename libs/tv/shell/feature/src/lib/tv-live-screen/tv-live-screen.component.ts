import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ElectronStreamHeadersService } from '@iptvnator/ui/playback/electron-stream-headers';
import { GamepadInputService, TvLiveCatalogFacade } from '@iptvnator/tv/data-access';
import {
    TvCategoryPillsComponent,
    TvChannelListComponent,
    TvImmersiveHintComponent,
    TvKeyboardInputDirective,
    TvLiveClockBadgeComponent,
    TvPlaybackController,
    TvPlaybackHudComponent,
    VOLUME_STEP,
} from '@iptvnator/tv/ui';
import { GridFocusController, GridFocusDirection } from '@iptvnator/tv/util';

const IDLE_TIMEOUT_MS = 5000;

type TvLivePane = 'pills' | 'channels';

/**
 * The one screen of v1: a translucent browsing panel over a full-bleed
 * video backdrop, and an immersive state once the panel auto-hides. Owns
 * both GridFocusController instances and decides which pane is "active" —
 * see the tv-mode plan's "Focus/navigation engine" section for why that
 * handoff isn't the controller's own job. Categories/channels come from
 * TvLiveCatalogFacade, which picks the first available playlist — v1 has no
 * source-switcher UI. Playback (video engine, preview-swap, volume/play-
 * pause HUD) is owned by TvPlaybackController; while immersive, Up/Down
 * control volume and Enter toggles play/pause instead of navigating —
 * Left (matching the mockup's "Press left for channels" hint) is the one
 * direction that still reveals the panel.
 */
@Component({
    selector: 'app-tv-live-screen',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        RouterLink,
        TvCategoryPillsComponent,
        TvChannelListComponent,
        TvImmersiveHintComponent,
        TvKeyboardInputDirective,
        TvLiveClockBadgeComponent,
        TvPlaybackHudComponent,
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

    readonly status = this.catalog.status;
    readonly playlistTitle = this.catalog.playlistTitle;

    readonly categories = computed(() => this.catalog.categories());
    readonly channels = computed(() => this.catalog.channels());

    readonly selectedCategoryId = signal<string | null>(null);
    readonly activePane = signal<TvLivePane>('channels');
    readonly panelVisible = signal(true);
    readonly activeChannelId = signal<string | null>(null);
    readonly clock = signal(this.formatClock());

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
                }
            });

        void this.bootstrap();
    }

    onDirection(direction: GridFocusDirection): void {
        if (!this.panelVisible()) {
            this.handleImmersiveDirection(direction);
            return;
        }
        this.wake();
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
        if (!this.panelVisible()) {
            this.playback.togglePlayPause();
            return;
        }
        this.wake();
        if (this.activePane() === 'pills') {
            this.pillsController.activate((index) => this.selectCategory(index));
        } else {
            this.channelsController.activate((index) => void this.playChannel(index));
        }
    }

    onBack(): void {
        if (!this.panelVisible()) {
            this.wake();
            return;
        }
        // No parent screen to leave in v1: Escape just collapses to immersive.
        this.collapseToImmersive();
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
