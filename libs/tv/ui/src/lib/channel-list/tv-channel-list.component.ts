import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { channelInitials, type TvLiveChannel } from '@iptvnator/tv/util';

@Component({
    selector: 'app-tv-channel-list',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        @if (channels().length === 0) {
            <p class="tv-channel-list__empty">No channels in this category</p>
        } @else {
        <div class="tv-channel-list">
            @for (channel of channels(); track channel.id; let i = $index) {
                <div
                    class="tv-channel-list__row"
                    [class.tv-channel-list__row--focused]="
                        i === focusedIndex()
                    "
                >
                    <div class="tv-channel-list__badge">
                        {{ initialsOf(channel.name) }}
                    </div>
                    <div class="tv-channel-list__body">
                        <div class="tv-channel-list__heading">
                            @if (channel.channelNumber !== undefined) {
                                <span class="tv-channel-list__number">{{
                                    channel.channelNumber
                                }}</span>
                            }
                            <span class="tv-channel-list__name">{{
                                channel.name
                            }}</span>
                        </div>
                        @if (channel.currentProgramTitle) {
                            <div class="tv-channel-list__program">
                                {{ channel.currentProgramTitle }}
                            </div>
                        }
                        @if (
                            i === focusedIndex() &&
                            channel.currentProgramProgress !== undefined
                        ) {
                            <div class="tv-channel-list__progress-track">
                                <div
                                    class="tv-channel-list__progress-fill"
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
        }
    `,
    styles: [
        `
            .tv-channel-list__empty {
                margin: 0;
                padding: 24px 22px;
                font-size: 15px;
                color: var(--tv-text-dim);
            }

            .tv-channel-list {
                display: flex;
                flex-direction: column;
                gap: 6px;
                padding-right: 36px;
                overflow: hidden;

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

                &__heading {
                    display: flex;
                    align-items: baseline;
                    gap: 10px;
                }

                &__number {
                    font-size: 14px;
                    color: var(--tv-text-dim);
                }

                &__row--focused &__number {
                    color: var(--tv-text-body-muted);
                }

                &__name {
                    font-size: 19px;
                    color: var(--tv-text-body-muted);
                }

                &__row--focused &__name {
                    font-weight: 600;
                    color: var(--tv-text-heading);
                }

                &__program {
                    font-size: 15px;
                    color: var(--tv-text-dim);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                &__row--focused &__program {
                    color: var(--tv-text-body-muted);
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
export class TvChannelListComponent {
    readonly channels = input.required<readonly TvLiveChannel[]>();
    readonly focusedIndex = input<number | null>(null);

    protected readonly initialsOf = channelInitials;
}
