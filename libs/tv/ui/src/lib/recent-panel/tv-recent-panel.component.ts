import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    effect,
    inject,
    input,
} from '@angular/core';
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
                        [attr.data-row-index]="i"
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

    private readonly hostEl = inject(ElementRef<HTMLElement>);

    /** Keeps the focused row on screen as focus moves past the visible
     * area — the panel div itself scrolls (see its styles above), and has
     * no native focus for the browser to follow, since the signal-driven
     * `focusedIndex` is the only source of truth per the tv-mode focus
     * engine. Same vertical math `TvCategoryListComponent`/
     * `TvChannelGridComponent` use. */
    constructor() {
        effect(() => {
            const index = this.focusedIndex();
            if (index === null) {
                return;
            }

            queueMicrotask(() => {
                const container =
                    this.hostEl.nativeElement.querySelector<HTMLElement>(
                        '.tv-recent-panel'
                    );
                const row = container?.querySelector(
                    `[data-row-index="${index}"]`
                );
                if (
                    !container ||
                    !row ||
                    typeof container.scrollTo !== 'function'
                ) {
                    return;
                }

                const containerRect = container.getBoundingClientRect();
                const rowRect = row.getBoundingClientRect();
                const targetTop =
                    container.scrollTop +
                    (rowRect.top - containerRect.top) -
                    container.clientHeight / 2 +
                    rowRect.height / 2;
                const maxScrollTop = Math.max(
                    0,
                    container.scrollHeight - container.clientHeight
                );

                container.scrollTo({
                    top: Math.min(maxScrollTop, Math.max(0, targetTop)),
                });
            });
        });
    }
}
