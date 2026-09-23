import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { channelInitials, type TvLiveChannel } from '@iptvnator/tv/util';

/**
 * Grid browse mode's channel view (`Settings.tvBrowseMode === 'grid'`) — a
 * fixed 6-column grid of tiles filling most of the screen (the category
 * rail moves beside it as `TvCategoryListComponent`, not above it),
 * alternative to `TvChannelListComponent`'s single-column rows. Same
 * underlying focus index as the list (`i === focusedIndex()`); the shell's
 * `GridFocusController` just gets a `columnCount` of 6 instead of 1, so the
 * 2D move math it already had is what makes Up/Down/Left/Right work here
 * unchanged — the column count here MUST match `TV_GRID_COLUMNS` in
 * `tv-live-screen.component.ts`, or the controller's index math and the
 * rendered layout disagree. Deliberately shows
 * only logo/number/name plus a slim progress bar on the focused tile — no
 * programme title/description, that's what the channel-info overlay
 * (already shown automatically on activation) is for.
 */
@Component({
    selector: 'app-tv-channel-grid',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="tv-channel-grid">
            @for (channel of channels(); track channel.id; let i = $index) {
                <div
                    class="tv-channel-grid__tile"
                    [class.tv-channel-grid__tile--focused]="i === focusedIndex()"
                >
                    <div class="tv-channel-grid__logo">
                        @if (showLogo(channel)) {
                            <img
                                class="tv-channel-grid__logo-image"
                                [src]="channel.logoUrl"
                                [alt]="channel.name"
                                (error)="onLogoError(channel)"
                            />
                        } @else {
                            {{ channelInitials(channel.name) }}
                        }
                    </div>
                    <div class="tv-channel-grid__body">
                        <div class="tv-channel-grid__heading">
                            @if (channel.channelNumber !== undefined) {
                                <span class="tv-channel-grid__number">{{
                                    channel.channelNumber
                                }}</span>
                            }
                            <span class="tv-channel-grid__name">{{
                                channel.name
                            }}</span>
                        </div>
                        @if (
                            i === focusedIndex() &&
                            channel.currentProgramProgress !== undefined
                        ) {
                            <div class="tv-channel-grid__progress-track">
                                <div
                                    class="tv-channel-grid__progress-fill"
                                    [style.width.%]="
                                        channel.currentProgramProgress * 100
                                    "
                                ></div>
                            </div>
                        }
                    </div>
                </div>
            }
        </div>
    `,
    styles: [
        `
            .tv-channel-grid {
                display: grid;
                grid-template-columns: repeat(6, 172px);
                gap: 16px;
                padding-right: 20px;
                overflow-y: auto;
                overflow-x: hidden;

                &__tile {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    border-radius: 14px;
                    transition:
                        box-shadow 0.15s ease-out,
                        transform 0.15s ease-out;

                    &--focused {
                        transform: translateY(-2px);
                        box-shadow:
                            0 0 0 2px var(--tv-accent),
                            0 10px 20px -16px var(--tv-accent-glow);
                    }
                }

                &__logo {
                    width: 172px;
                    height: 120px;
                    border-radius: 12px;
                    background: var(--tv-muted-card-fill);
                    color: var(--tv-text-body-muted);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 22px;
                    font-weight: 700;
                    overflow: hidden;
                    flex-shrink: 0;
                }

                &__logo-image {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    padding: 12px;
                    box-sizing: border-box;
                }

                &__body {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    min-width: 0;
                }

                &__heading {
                    display: flex;
                    align-items: baseline;
                    gap: 8px;
                    min-width: 0;
                }

                &__number {
                    font-size: 13px;
                    color: var(--tv-text-dim);
                    flex-shrink: 0;
                }

                &__name {
                    font-size: 15px;
                    color: var(--tv-text-body-muted);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                &__tile--focused &__name {
                    font-weight: 600;
                    color: var(--tv-text-heading);
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
            }
        `,
    ],
})
export class TvChannelGridComponent {
    readonly channels = input.required<readonly TvLiveChannel[]>();
    readonly focusedIndex = input<number | null>(null);

    protected readonly channelInitials = channelInitials;

    /** Channel ids whose logo failed to load — a plain per-tile fallback
     * since (unlike the single-channel info overlay) a grid has many tiles
     * to track independently. */
    private readonly failedLogoIds = signal<ReadonlySet<string>>(new Set());

    protected showLogo(channel: TvLiveChannel): boolean {
        return !!channel.logoUrl && !this.failedLogoIds().has(channel.id);
    }

    protected onLogoError(channel: TvLiveChannel): void {
        this.failedLogoIds.update((ids) => new Set(ids).add(channel.id));
    }
}
