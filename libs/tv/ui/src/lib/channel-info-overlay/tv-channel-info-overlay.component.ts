import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
    signal,
} from '@angular/core';
import { channelInitials, type TvLiveChannel } from '@iptvnator/tv/util';

function formatTimeRange(startIso?: string, stopIso?: string): string {
    if (!startIso || !stopIso) {
        return '';
    }
    const start = new Date(startIso);
    const stop = new Date(stopIso);
    if (Number.isNaN(start.getTime()) || Number.isNaN(stop.getTime())) {
        return '';
    }
    const format = (date: Date) =>
        date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return `${format(start)} – ${format(stop)}`;
}

/**
 * "Info" overlay for the focused/playing channel — Y (gamepad) or `KeyI`.
 * Reuses the translucent-panel visual language rather than a new one. Shows
 * whatever `TvLiveChannel`'s current-programme fields already carry (see
 * `libs/tv/data-access`'s per-source EPG wiring); a channel with no known
 * programme still shows its name/badge with an explicit empty state rather
 * than an empty-looking card.
 */
@Component({
    selector: 'app-tv-channel-info-overlay',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        @if (channel(); as channel) {
            <div
                class="tv-channel-info-overlay"
                [class.tv-channel-info-overlay--visible]="visible()"
            >
                <div class="tv-channel-info-overlay__badge">
                    @if (showLogo()) {
                        <img
                            class="tv-channel-info-overlay__logo"
                            [src]="channel.logoUrl"
                            [alt]="channel.name"
                            (error)="onLogoError()"
                        />
                    } @else {
                        {{ channelInitials(channel.name) }}
                    }
                </div>
                <div class="tv-channel-info-overlay__body">
                    <div class="tv-channel-info-overlay__heading">
                        @if (channel.channelNumber !== undefined) {
                            <span
                                class="tv-channel-info-overlay__number"
                                >{{ channel.channelNumber }}</span
                            >
                        }
                        <span class="tv-channel-info-overlay__name">{{
                            channel.name
                        }}</span>
                    </div>
                    @if (channel.currentProgramTitle) {
                        <div class="tv-channel-info-overlay__program">
                            <span
                                class="tv-channel-info-overlay__program-title"
                                >{{ channel.currentProgramTitle }}</span
                            >
                            @if (timeRange()) {
                                <span
                                    class="tv-channel-info-overlay__program-time"
                                    >{{ timeRange() }}</span
                                >
                            }
                        </div>
                        @if (channel.currentProgramProgress !== undefined) {
                            <div
                                class="tv-channel-info-overlay__progress-track"
                            >
                                <div
                                    class="tv-channel-info-overlay__progress-fill"
                                    [style.width.%]="
                                        channel.currentProgramProgress * 100
                                    "
                                ></div>
                            </div>
                        }
                        @if (channel.currentProgramDescription) {
                            <p class="tv-channel-info-overlay__description">
                                {{ channel.currentProgramDescription }}
                            </p>
                        }
                    } @else {
                        <p class="tv-channel-info-overlay__empty">
                            No programme information available
                        </p>
                    }
                </div>
            </div>
        }
    `,
    styles: [
        `
            .tv-channel-info-overlay {
                position: absolute;
                left: 48px;
                right: 48px;
                bottom: 44px;
                max-width: 620px;
                display: flex;
                gap: 18px;
                padding: 22px 26px;
                border-radius: 18px;
                background: rgba(13, 15, 18, 0.86);
                opacity: 0;
                transform: translateY(8px);
                pointer-events: none;
                transition:
                    opacity 0.2s ease-out,
                    transform 0.2s ease-out;

                &--visible {
                    opacity: 1;
                    transform: translateY(0);
                }

                &__badge {
                    width: 56px;
                    height: 56px;
                    border-radius: 12px;
                    background: var(--tv-muted-card-fill);
                    color: var(--tv-text-body-muted);
                    flex-shrink: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 18px;
                    font-weight: 700;
                    overflow: hidden;
                }

                &__logo {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    padding: 6px;
                    box-sizing: border-box;
                }

                &__body {
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                &__heading {
                    display: flex;
                    align-items: baseline;
                    gap: 10px;
                }

                &__number {
                    font-size: 14px;
                    color: var(--tv-text-dim);
                }

                &__name {
                    font-size: 18px;
                    font-weight: 600;
                    color: var(--tv-text-heading);
                }

                &__program {
                    display: flex;
                    align-items: baseline;
                    gap: 12px;
                    flex-wrap: wrap;
                }

                &__program-title {
                    font-size: 20px;
                    font-weight: 600;
                    color: var(--tv-text-heading-alt);
                }

                &__program-time {
                    font-size: 14px;
                    color: var(--tv-text-dim);
                }

                &__progress-track {
                    height: 3px;
                    border-radius: 2px;
                    background: rgba(255, 255, 255, 0.14);
                }

                &__progress-fill {
                    height: 100%;
                    border-radius: 2px;
                    background: var(--tv-accent);
                }

                &__description {
                    margin: 0;
                    font-size: 14px;
                    line-height: 1.4;
                    color: var(--tv-text-body-muted);
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }

                &__empty {
                    margin: 0;
                    font-size: 14px;
                    color: var(--tv-text-dim);
                }
            }
        `,
    ],
})
export class TvChannelInfoOverlayComponent {
    readonly channel = input<TvLiveChannel | null>(null);
    readonly visible = input<boolean>(false);

    protected readonly channelInitials = channelInitials;

    /** The `logoUrl` that most recently failed to load, so a channel switch
     * (a different or absent `logoUrl`) always gets a fresh attempt without
     * needing to reset this on every channel change. */
    private readonly failedLogoUrl = signal<string | null>(null);

    protected readonly showLogo = computed(() => {
        const url = this.channel()?.logoUrl;
        return !!url && url !== this.failedLogoUrl();
    });

    protected onLogoError(): void {
        this.failedLogoUrl.set(this.channel()?.logoUrl ?? null);
    }

    protected readonly timeRange = computed(() => {
        const channel = this.channel();
        return channel
            ? formatTimeRange(
                  channel.currentProgramStart,
                  channel.currentProgramStop
              )
            : '';
    });
}
