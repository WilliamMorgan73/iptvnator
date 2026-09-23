import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ElectronStreamHeadersService } from '@iptvnator/ui/playback/electron-stream-headers';
import { GamepadInputService, TvLiveCatalogFacade } from '@iptvnator/tv/data-access';
import {
    TvCategoryListComponent,
    TvCategoryPillsComponent,
    TvChannelGridComponent,
    TvChannelInfoOverlayComponent,
    TvChannelListComponent,
    TvImmersiveHintComponent,
    TvKeyboardInputDirective,
    TvLiveClockBadgeComponent,
    TvPlaybackController,
    TvPlaybackHudComponent,
    TvSettingsPanelComponent,
    TvSourcePanelComponent,
} from '@iptvnator/tv/ui';
import {
    DEFAULT_TV_IDLE_TIMEOUT_SECONDS,
    adjustTvSettingsValue,
    resolveTvSettingsItems,
    type TvLiveChannel,
} from '@iptvnator/tv/util';
import { SettingsStore } from '@iptvnator/services';
import { TvLivePanesController } from './tv-live-panes.controller';

/** Longer than the volume/play-pause HUD's ~1.5s — there's more to read. */
const INFO_OVERLAY_TIMEOUT_MS = 6000;
/** Fixed, not responsive — matches the tv-mode plan's "Deferred" grid-mode
 * note. Must match `TvChannelGridComponent`'s own `repeat(6, 172px)` CSS. */
const TV_GRID_COLUMNS = 6;

/**
 * The one screen of v1: a translucent browsing panel over a full-bleed
 * video backdrop, and an immersive state once the panel auto-hides.
 * Categories/channels come from TvLiveCatalogFacade, which activates the
 * first available playlist on startup. Pane/focus state (pills/channels/
 * sources/settings, and every input's effect on them) is owned by
 * TvLivePanesController — see its own doc comment; this component wires it
 * to the catalog/settings/playback services it needs callbacks for, and
 * owns the info overlay and playback itself. While immersive, Up/Down
 * control volume and Enter toggles play/pause instead of navigating — Left
 * (matching the mockup's "Press left for channels" hint) is the one
 * direction that still reveals the panel.
 */
@Component({
    selector: 'app-tv-live-screen',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        RouterLink,
        TvCategoryListComponent,
        TvCategoryPillsComponent,
        TvChannelGridComponent,
        TvChannelInfoOverlayComponent,
        TvChannelListComponent,
        TvImmersiveHintComponent,
        TvKeyboardInputDirective,
        TvLiveClockBadgeComponent,
        TvPlaybackHudComponent,
        TvSettingsPanelComponent,
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
    private readonly settingsStore = inject(SettingsStore);
    private readonly videoRef =
        viewChild<ElementRef<HTMLVideoElement>>('video');
    private infoOverlayTimeoutId: ReturnType<typeof setTimeout> | null = null;

    readonly status = this.catalog.status;
    readonly playlistTitle = this.catalog.playlistTitle;
    readonly activePlaylistId = this.catalog.activePlaylistId;

    readonly categories = computed(() => this.catalog.categories());
    readonly channels = computed(() => this.catalog.channels());
    readonly sources = computed(() => this.catalog.sources());
    readonly settingsItems = computed(() =>
        resolveTvSettingsItems(this.settingsStore.getSettings())
    );
    readonly idleTimeoutMs = computed(
        () =>
            (this.settingsStore.getSettings().tvIdleTimeoutSeconds ??
                DEFAULT_TV_IDLE_TIMEOUT_SECONDS) * 1000
    );
    readonly browseMode = computed(
        () => this.settingsStore.getSettings().tvBrowseMode ?? 'list'
    );
    readonly channelColumns = computed(() =>
        this.browseMode() === 'grid' ? TV_GRID_COLUMNS : 1
    );

    readonly activeChannelId = signal<string | null>(null);
    readonly clock = signal(this.formatClock());
    readonly infoOverlayVisible = signal(false);

    readonly playback = new TvPlaybackController({
        resolvePlayback: (channel) => this.catalog.resolvePlayback(channel),
        applyHeaders: (playback, title) =>
            this.electronStreamHeaders.apply({ ...playback, title }),
    });

    readonly panes = new TvLivePanesController({
        categories: () => this.categories(),
        sources: () => this.sources(),
        settingsItems: () => this.settingsItems(),
        activePlaylistId: () => this.activePlaylistId(),
        channelColumns: () => this.channelColumns(),
        channelCount: () => this.channels().length,
        activeChannelIndex: () => {
            const index = this.channels().findIndex(
                (channel) => channel.id === this.activeChannelId()
            );
            return index === -1 ? null : index;
        },
        idleTimeoutMs: () => this.idleTimeoutMs(),
        onCategorySelected: (categoryId) => this.catalog.selectCategory(categoryId),
        selectPlaylist: (sourceId) => this.catalog.selectPlaylist(sourceId),
        adjustSetting: (itemId, direction) =>
            void this.settingsStore.updateSettings(
                adjustTvSettingsValue(this.settingsStore.getSettings(), itemId, direction)
            ),
        onChannelActivated: (index) => void this.playChannel(index),
        adjustVolume: (delta) => this.playback.adjustVolume(delta),
        togglePlayPause: () => this.playback.togglePlayPause(),
        dismissInfoOverlay: () => this.dismissInfoOverlay(),
    });

    /**
     * Channel the info overlay describes — the focused row while the panel
     * is open on the channels pane, otherwise the actively playing channel
     * (covers immersive playback, and the pills/sources panes where nothing
     * is "focused" in the channel-row sense).
     */
    readonly infoOverlayChannel = computed<TvLiveChannel | null>(() => {
        if (this.panes.panelVisible() && this.panes.activePane() === 'channels') {
            const index = this.panes.channelsController.focusedIndex();
            return index !== null ? (this.channels()[index] ?? null) : null;
        }
        const activeId = this.activeChannelId();
        return (
            this.channels().find((channel) => channel.id === activeId) ??
            null
        );
    });

    constructor() {
        const clockIntervalId = setInterval(
            () => this.clock.set(this.formatClock()),
            30_000
        );
        this.destroyRef.onDestroy(() => {
            clearInterval(clockIntervalId);
            if (this.infoOverlayTimeoutId !== null) {
                clearTimeout(this.infoOverlayTimeoutId);
            }
            this.panes.destroy();
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
                this.channels()[this.panes.channelsController.focusedIndex() ?? -1];
            this.playback.schedulePreview(channel);
        });

        this.gamepadInput.actions$
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((action) => {
                switch (action.kind) {
                    case 'direction':
                        this.panes.onDirection(action.direction);
                        break;
                    case 'activate':
                        this.panes.onActivate();
                        break;
                    case 'back':
                        this.panes.onBack();
                        break;
                    case 'categoryStep':
                        this.panes.onCategoryStep(action.direction);
                        break;
                    case 'toggleSources':
                        this.panes.onToggleSources();
                        break;
                    case 'toggleInfo':
                        this.onToggleInfo();
                        break;
                    case 'openSettings':
                        this.panes.onToggleSettings();
                        break;
                }
            });

        void this.bootstrap();
    }

    /**
     * Gamepad Y (or keyboard `KeyI`): shows the channel-info overlay for
     * `infoOverlayChannel()`. Deliberately does not reveal the panel —
     * pressing Info during immersive playback should work without first
     * bringing back the channel list, matching the plan's restraint.
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

    private async bootstrap(): Promise<void> {
        await this.catalog.initialize();
        if (this.catalog.status() !== 'ready') {
            return;
        }
        if (this.categories().length === 0) {
            return;
        }
        this.panes.selectCategory(0);
    }

    private async playChannel(index: number): Promise<void> {
        const channel = this.channels()[index];
        this.activeChannelId.set(channel.id);
        this.panes.collapseToImmersive();
        // Same temporary overlay as the manual Info action — confirming a
        // channel into fullscreen should announce what just started playing
        // without requiring a second button press.
        this.revealInfoOverlay();
        await this.playback.playNow(channel);
    }

    private formatClock(): string {
        return new Date().toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
        });
    }
}
