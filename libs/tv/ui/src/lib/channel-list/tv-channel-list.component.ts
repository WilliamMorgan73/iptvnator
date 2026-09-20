import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { TvLiveChannel } from '@iptvnator/tv/util';

function initialsOf(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
        return '';
    }
    if (words.length === 1) {
        return words[0].slice(0, 2).toUpperCase();
    }
    return (words[0][0] + words[1][0]).toUpperCase();
}

@Component({
    selector: 'app-tv-channel-list',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
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
    `,
    styles: [
        `
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

    protected readonly initialsOf = initialsOf;
}
