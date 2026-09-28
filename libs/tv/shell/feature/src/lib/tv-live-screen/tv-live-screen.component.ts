import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { ElectronStreamHeadersService } from '@iptvnator/ui/playback/electron-stream-headers';
import { GamepadInputService, TvLiveCatalogFacade } from '@iptvnator/tv/data-access';
import {
    TvCategoryListComponent,
    TvCategoryPillsComponent,
    TvChannelGridComponent,
    TvChannelInfoOverlayComponent,
    TvChannelListComponent,
    TvDigitEntryOverlayComponent,
    TvEpgGuideController,
    TvEpgGuideGridComponent,
    TvImmersiveHintComponent,
    TvKeyboardInputDirective,
    TvLiveClockBadgeComponent,
    TvPlaybackController,
    TvPlaybackHudComponent,
    TvRecentPanelComponent,
    TvRecordingController,
    TvRecordingIndicatorComponent,
    TvRecordingsPanelComponent,
    TvSettingsPanelComponent,
    TvSourcePanelComponent,
} from '@iptvnator/tv/ui';
import {
    DEFAULT_TV_IDLE_TIMEOUT_SECONDS,
    adjustTvSettingsValue,
    resolveTvSettingsItems,
    type GridFocusDirection,
    type TvLiveChannel,
} from '@iptvnator/tv/util';
import {
    RecordingsService,
    SettingsStore,
    type RecordingItem,
} from '@iptvnator/services';
import type { TvRecordingStartRequest } from '@iptvnator/shared/interfaces';
import { TvDigitEntryController } from './tv-digit-entry.controller';
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
        TvDigitEntryOverlayComponent,
        TvEpgGuideGridComponent,
        TvImmersiveHintComponent,
        TvKeyboardInputDirective,
        TvLiveClockBadgeComponent,
        TvPlaybackHudComponent,
        TvRecentPanelComponent,
        TvRecordingIndicatorComponent,
        TvRecordingsPanelComponent,
        TvSettingsPanelComponent,
        TvSourcePanelComponent,
    ],
    templateUrl: './tv-live-screen.component.html',
    styleUrls: ['./tv-live-screen.component.scss'],
})
export class TvLiveScreenComponent {
    private readonly destroyRef = inject(DestroyRef);
    private readonly router = inject(Router);
    private readonly gamepadInput = inject(GamepadInputService);
    private readonly catalog = inject(TvLiveCatalogFacade);
    private readonly electronStreamHeaders = inject(ElectronStreamHeadersService);
    private readonly settingsStore = inject(SettingsStore);
    private readonly recordingsService = inject(RecordingsService);
    private readonly videoRef =
        viewChild<ElementRef<HTMLVideoElement>>('video');
    private infoOverlayTimeoutId: ReturnType<typeof setTimeout> | null = null;

    readonly status = this.catalog.status;
    readonly playlistTitle = this.catalog.playlistTitle;
    readonly activePlaylistId = this.catalog.activePlaylistId;

    readonly categories = computed(() => this.catalog.categories());
    readonly channels = computed(() => this.catalog.channels());
    /** Name of the currently selected category, for the guide's title —
     * null while nothing is selected yet (e.g. before bootstrap resolves). */
    readonly selectedCategoryName = computed(
        () =>
            this.categories().find(
                (category) => category.id === this.panes.selectedCategoryId()
            )?.name ?? null
    );
    readonly sources = computed(() => this.catalog.sources());
    readonly recentChannels = computed(() => this.catalog.recentChannels());
    readonly recordings = computed(() => this.recordingsService.recordings());
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
        recentChannels: () => this.recentChannels(),
        recordings: () => this.recordings(),
        onCategorySelected: (categoryId) => this.catalog.selectCategory(categoryId),
        selectPlaylist: (sourceId) => this.catalog.selectPlaylist(sourceId),
        adjustSetting: (itemId, direction) =>
            void this.settingsStore.updateSettings(
                adjustTvSettingsValue(this.settingsStore.getSettings(), itemId, direction)
            ),
        onChannelActivated: (index) => void this.playChannel(index),
        onRecentChannelActivated: (channel) =>
            void this.activateChannelFromAnywhere(channel),
        onRecordingActivated: (recording) => this.playRecording(recording),
        openGuide: () =>
            this.epgGuide.open(
                this.activeChannelId(),
                this.channels().map((channel) => channel.id)
            ),
        closeGuide: () => this.closeGuideWithContinuity(),
        onGuideDirection: (direction) => this.onGuideDirection(direction),
        onGuideActivate: () => this.onGuideActivate(),
        onGuideStepDay: (direction) => this.epgGuide.stepDay(direction),
        adjustVolume: (delta) => this.playback.adjustVolume(delta),
        togglePlayPause: () => this.playback.togglePlayPause(),
        dismissInfoOverlay: () => this.dismissInfoOverlay(),
        onAddSourceRequested: () => void this.router.navigateByUrl('/add-source'),
    });

    readonly recording = new TvRecordingController({
        activeRecording: () => this.recordingsService.activeRecording(),
        start: (request) => this.recordingsService.startTvRecording(request),
        stop: (recordingId) => this.recordingsService.stopRecording(recordingId),
    });

    readonly digitEntry = new TvDigitEntryController({
        channels: () => this.catalog.channelsAcrossCategories(),
        onChannelResolved: (channel) =>
            void this.activateChannelFromAnywhere(channel),
    });

    readonly epgGuide = new TvEpgGuideController({
        adapter: () => this.catalog.epgGuideAdapter(),
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
            this.digitEntry.destroy();
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

        // Applies `Settings.showCaptions` to the video engine — both the
        // initial value (this effect's first run, ordered after the attach
        // effect above so the engine already exists) and any later live
        // change, without reloading the current stream.
        effect(() => {
            const enabled =
                this.settingsStore.getSettings().showCaptions ?? false;
            this.playback.setCaptionsEnabled(enabled);
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
                    case 'toggleRecent':
                        this.panes.onToggleRecent();
                        break;
                    case 'toggleRecord':
                        void this.onToggleRecord();
                        break;
                    case 'toggleRecordingsList':
                        this.panes.onToggleRecordings();
                        break;
                    case 'openGuide':
                        this.panes.onToggleGuide();
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
        if (!channel) {
            return;
        }
        await this.activateChannel(channel);
    }

    /**
     * Shared by numeric channel entry (`TvDigitEntryController`) and the
     * Recently Viewed pane — both resolve a channel from the whole active
     * source, cross-category, so unlike `playChannel()` the target may not
     * be in the currently selected category's list at all. Switches category
     * first (the same visual-state update ordinary category-pill navigation
     * already does, including resetting `channelsController.focusedIndex` to
     * 0 — nothing new here) so the channel list panel is consistent if the
     * user reveals it afterward, then activates by channel object directly
     * rather than by index, since an index into the (possibly
     * not-yet-refreshed) new category's list isn't available synchronously
     * for every source kind.
     */
    private async activateChannelFromAnywhere(
        channel: TvLiveChannel
    ): Promise<void> {
        if (channel.categoryId !== this.panes.selectedCategoryId()) {
            const categoryIndex = this.categories().findIndex(
                (category) => category.id === channel.categoryId
            );
            if (categoryIndex !== -1) {
                this.panes.selectCategory(categoryIndex);
            }
        }
        await this.activateChannel(channel);
    }

    /** Shared activation core: updates state, collapses to immersive, shows
     * the info overlay, starts playback, and records the confirmed view.
     * `playChannel()` (index into the current channel list) and
     * `activateChannelFromAnywhere()` (a channel object resolved from
     * anywhere in the source) both funnel through this — the single correct
     * call site for `recordRecentlyViewed`, never a preview. */
    private async activateChannel(channel: TvLiveChannel): Promise<void> {
        this.activeChannelId.set(channel.id);
        this.panes.collapseToImmersive();
        // Same temporary overlay as the manual Info action — confirming a
        // channel into fullscreen should announce what just started playing
        // without requiring a second button press.
        this.revealInfoOverlay();
        await this.playback.playNow(channel);
        this.catalog.recordRecentlyViewed(channel);
    }

    /** A completed/interrupted recording's row was activated — plays the
     * local file directly, independent of the channel-activation path
     * above (not a channel, no recently-viewed write, no category switch). */
    private playRecording(recording: RecordingItem): void {
        this.activeChannelId.set(null);
        this.panes.collapseToImmersive();
        this.playback.playRecording(recording.filePath);
    }

    /** Maps a D-pad direction onto the guide's 2D focus — up/down move
     * between channel rows, left/right move between a row's programme
     * blocks. Reused for both the gamepad and keyboard `direction` output,
     * same as every other pane. */
    private onGuideDirection(direction: GridFocusDirection): void {
        if (direction === 'up') {
            this.epgGuide.focus.moveRow(-1);
        } else if (direction === 'down') {
            this.epgGuide.focus.moveRow(1);
        } else if (direction === 'left') {
            this.epgGuide.focus.moveBlock(-1);
        } else {
            this.epgGuide.focus.moveBlock(1);
        }
    }

    /** Closes the guide, carrying the row it was left on back into the
     * channel list's own focus, so browsing continues from the same channel
     * instead of resetting — the guide is scoped to the current category
     * (see `openGuide` above), so the channel is always present in
     * `channels()`, no cross-category lookup needed. Reads
     * `epgGuide.focusedChannel()` before `close()` resets guide focus. */
    private closeGuideWithContinuity(): void {
        const guideChannel = this.epgGuide.focusedChannel();
        this.epgGuide.close();
        if (!guideChannel) {
            return;
        }
        const index = this.channels().findIndex(
            (channel) => channel.id === guideChannel.id
        );
        if (index !== -1) {
            this.panes.channelsController.focusedIndex.set(index);
        }
    }

    /** Resolves the guide's focused row to a real `TvLiveChannel` (the guide
     * only knows the trimmed `TvEpgGuideChannel` shape) and activates it via
     * the same cross-category path Recently Viewed/digit entry use — the
     * focused channel may not be in the currently selected category. */
    private onGuideActivate(): void {
        this.epgGuide.focus.activate((row) => {
            const guideChannel = this.epgGuide.channels()[row];
            if (!guideChannel) {
                return;
            }
            const channel = this.catalog
                .channelsAcrossCategories()
                .find((item) => item.id === guideChannel.id);
            if (channel) {
                void this.activateChannelFromAnywhere(channel);
            }
        });
    }

    /** Gamepad RT/R2 (or keyboard `KeyR`): starts recording whatever is
     * currently playing, or stops the active recording if there is one.
     * Public: bound directly from the template's `(toggleRecord)` output,
     * same as `onToggleInfo()`. */
    async onToggleRecord(): Promise<void> {
        await this.recording.toggle(() => this.buildRecordingRequest());
    }

    /** Resolves a FRESH stream URL rather than reusing the one already
     * playing — Stalker's temporary playback links live only a few seconds,
     * so an old one cannot be reused for a long-running recording. */
    private async buildRecordingRequest(): Promise<TvRecordingStartRequest | null> {
        const activeId = this.activeChannelId();
        const channel =
            this.channels().find((item) => item.id === activeId) ??
            this.catalog.channelsAcrossCategories().find((item) => item.id === activeId);
        if (!channel) {
            return null;
        }
        const playback = await this.catalog.resolvePlayback(channel);
        return {
            metadata: {
                channelName: channel.name,
                channelLogoUrl: channel.logoUrl,
                playlistId: this.activePlaylistId() ?? undefined,
                playlistName: this.playlistTitle() ?? undefined,
                sourceType: channel.sourceKind,
                currentProgram: channel.currentProgramTitle
                    ? {
                          title: channel.currentProgramTitle,
                          description: channel.currentProgramDescription,
                          start: channel.currentProgramStart ?? '',
                          stop: channel.currentProgramStop ?? '',
                      }
                    : undefined,
            },
            streamUrl: playback.streamUrl,
            userAgent: playback.userAgent,
            referer: playback.referer,
            origin: playback.origin,
            headers: playback.headers,
        };
    }

    private formatClock(): string {
        return new Date().toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
        });
    }
}
