import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { GamepadInputService } from '@iptvnator/tv/data-access';
import {
    TvCategoryPillsComponent,
    TvChannelListComponent,
    TvImmersiveHintComponent,
    TvKeyboardInputDirective,
    TvLiveClockBadgeComponent,
} from '@iptvnator/tv/ui';
import { GridFocusController, GridFocusDirection } from '@iptvnator/tv/util';
import {
    TV_LIVE_FIXTURE_CATEGORIES,
    TV_LIVE_FIXTURE_CHANNELS_BY_CATEGORY,
} from '../tv-live-fixtures';

const IDLE_TIMEOUT_MS = 5000;

type TvLivePane = 'pills' | 'channels';

/**
 * The one screen of v1: a translucent browsing panel over a full-bleed
 * backdrop (a placeholder gradient until Milestone 4 wires real video), and
 * an immersive state once the panel auto-hides. Owns both GridFocusController
 * instances and decides which pane is "active" — see the tv-mode plan's
 * "Focus/navigation engine" section for why that handoff isn't the
 * controller's own job.
 */
@Component({
    selector: 'app-tv-live-screen',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        TvCategoryPillsComponent,
        TvChannelListComponent,
        TvImmersiveHintComponent,
        TvKeyboardInputDirective,
        TvLiveClockBadgeComponent,
    ],
    templateUrl: './tv-live-screen.component.html',
    styleUrls: ['./tv-live-screen.component.scss'],
})
export class TvLiveScreenComponent {
    private readonly destroyRef = inject(DestroyRef);
    private readonly gamepadInput = inject(GamepadInputService);
    private idleTimeoutId: ReturnType<typeof setTimeout> | null = null;

    readonly categories = TV_LIVE_FIXTURE_CATEGORIES;

    readonly selectedCategoryId = signal(this.categories[1].id); // 'sports', matching the mockup
    readonly activePane = signal<TvLivePane>('channels');
    readonly panelVisible = signal(true);
    readonly activeChannelId = signal<string | null>(null);
    readonly clock = signal(this.formatClock());

    readonly channels = computed(
        () =>
            TV_LIVE_FIXTURE_CHANNELS_BY_CATEGORY[this.selectedCategoryId()] ??
            []
    );

    readonly pillsController = new GridFocusController({
        itemCount: () => this.categories.length,
        columnCount: () => this.categories.length, // single row: left/right move, up/down no-op
    });

    readonly channelsController = new GridFocusController({
        itemCount: () => this.channels().length,
        columnCount: () => 1, // vertical list: up/down move, left/right no-op
    });

    constructor() {
        const selectedIndex = this.categories.findIndex(
            (category) => category.id === this.selectedCategoryId()
        );
        this.pillsController.focusedIndex.set(Math.max(0, selectedIndex));
        this.channelsController.focusedIndex.set(0);
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
    }

    onDirection(direction: GridFocusDirection): void {
        if (!this.wake()) {
            return; // First input after idle only redisplays the panel.
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

    onActivate(): void {
        if (!this.wake()) {
            return;
        }
        if (this.activePane() === 'pills') {
            this.pillsController.activate((index) => this.selectCategory(index));
        } else {
            this.channelsController.activate((index) => this.playChannel(index));
        }
    }

    onBack(): void {
        if (!this.wake()) {
            return;
        }
        // No parent screen to leave in v1: Escape just collapses to immersive.
        this.collapseToImmersive();
    }

    /** Gamepad LB/RB (or PageUp/PageDown): flips category directly, skipping the pills pane. */
    onCategoryStep(direction: 'previous' | 'next'): void {
        if (!this.wake()) {
            return;
        }
        const currentIndex = this.categories.findIndex(
            (category) => category.id === this.selectedCategoryId()
        );
        const nextIndex = currentIndex + (direction === 'next' ? 1 : -1);
        if (nextIndex < 0 || nextIndex >= this.categories.length) {
            return; // No-op at the boundary, same rule as GridFocusController.
        }
        this.pillsController.focusedIndex.set(nextIndex);
        this.selectCategory(nextIndex);
    }

    private selectCategory(index: number): void {
        const category = this.categories[index];
        this.selectedCategoryId.set(category.id);
        this.channelsController.focusedIndex.set(0);
        this.activePane.set('channels');
    }

    private playChannel(index: number): void {
        const channel = this.channels()[index];
        this.activeChannelId.set(channel.id);
        this.collapseToImmersive();
    }

    private collapseToImmersive(): void {
        this.panelVisible.set(false);
        if (this.idleTimeoutId !== null) {
            clearTimeout(this.idleTimeoutId);
            this.idleTimeoutId = null;
        }
    }

    /** Redisplays the panel and resets the idle timer; returns whether it was already visible. */
    private wake(): boolean {
        const wasVisible = this.panelVisible();
        this.panelVisible.set(true);
        this.resetIdleTimer();
        return wasVisible;
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
