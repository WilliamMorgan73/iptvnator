import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { channelInitials, type TvLiveChannel } from '@iptvnator/tv/util';

/**
 * The Recently Viewed pane — same heading/row-list shell as
 * `TvSourcePanelComponent`, with `TvChannelListComponent`'s row content
 * (badge/initials, name, current program) so a recent entry reads exactly
 * like it does in the ordinary channel list. Its own component rather than
 * either of those reused directly: it needs a heading label ("Recently
 * Viewed") and an empty state ("nothing watched yet") neither existing
 * component parameterizes.
 */
@Component({
    selector: 'app-tv-recent-panel',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="tv-recent-panel">
            <div class="tv-recent-panel__heading">Recently Viewed</div>
            @if (channels().length === 0) {
                <p class="tv-recent-panel__empty">Nothing watched yet</p>
            } @else {
                @for (
                    channel of channels();
                    track channel.id;
                    let i = $index
                ) {
                    <div
                        class="tv-recent-panel__row"
                        [class.tv-recent-panel__row--focused]="
                            i === focusedIndex()
                        "
                    >
                        <div class="tv-recent-panel__badge">
                            {{ initialsOf(channel.name) }}
                        </div>
                        <div class="tv-recent-panel__body">
                            <div class="tv-recent-panel__name">
                                {{ channel.name }}
                            </div>
                            @if (channel.currentProgramTitle) {
                                <div class="tv-recent-panel__program">
                                    {{ channel.currentProgramTitle }}
                                </div>
                            }
                        </div>
                    </div>
                }
            }
        </div>
    `,
    styles: [
        `
            .tv-recent-panel {
                display: flex;
                flex-direction: column;
                gap: 6px;
                overflow-y: auto;
                overflow-x: hidden;
                scrollbar-width: none;

                &::-webkit-scrollbar {
                    display: none;
                }

                &__heading {
                    font-size: 13px;
                    font-weight: 600;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    color: var(--tv-text-dim);
                    padding: 0 22px 4px;
                }

                &__empty {
                    margin: 0;
                    padding: 24px 22px;
                    font-size: 15px;
                    color: var(--tv-text-dim);
                }

                &__row {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 14px 22px;
                    border-radius: 14px;

                    &--focused {
                        background: var(--tv-panel-focused-tint);
                        border-left: 4px solid var(--tv-accent);
                        margin-left: -4px;
                        padding-left: 18px;
                    }
                }

                &__badge {
                    width: 46px;
                    height: 46px;
                    border-radius: 10px;
                    background: var(--tv-muted-card-fill);
                    color: var(--tv-text-body-muted);
                    flex-shrink: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 15px;
                    font-weight: 700;
                }

                &__row--focused &__badge {
                    background: var(--tv-accent);
                    color: var(--tv-accent-on);
                }

                &__body {
                    flex-grow: 1;
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 5px;
                }

                &__name {
                    font-size: 18px;
                    color: var(--tv-text-body-muted);
                }

                &__row--focused &__name {
                    font-weight: 600;
                    color: var(--tv-text-heading);
                }

                &__program {
                    font-size: 13px;
                    color: var(--tv-text-dim);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                &__row--focused &__program {
                    color: var(--tv-text-body-muted);
                }
            }
        `,
    ],
})
export class TvRecentPanelComponent {
    readonly channels = input.required<readonly TvLiveChannel[]>();
    readonly focusedIndex = input<number | null>(null);

    protected readonly initialsOf = channelInitials;
}
