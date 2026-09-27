import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { EpgProgram } from '@iptvnator/shared/interfaces';
import {
    channelInitials,
    computeEpgGuideBlockLayout,
    computeEpgGuideNowPercent,
    type TvEpgGuideChannel,
} from '@iptvnator/tv/util';

interface EpgGuideBlockView {
    readonly program: EpgProgram;
    readonly leftPercent: number;
    readonly widthPercent: number;
}

/** One channel row: a fixed channel badge/name column, then a horizontal
 * strip of the day's programme blocks positioned by percentage. Kept as its
 * own component (not inlined into the grid) so the grid stays a thin
 * `@for` host — matches the channel-list/channel-grid split pattern already
 * established elsewhere in `libs/tv/ui`. */
@Component({
    selector: 'app-tv-epg-guide-row',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div
            class="tv-epg-guide-row"
            [class.tv-epg-guide-row--focused]="focused()"
        >
            <div class="tv-epg-guide-row__channel">
                <div class="tv-epg-guide-row__badge">
                    {{ initialsOf(channel().name) }}
                </div>
                <div class="tv-epg-guide-row__name">{{ channel().name }}</div>
            </div>
            <div class="tv-epg-guide-row__timeline">
                @if (nowPercent(); as now) {
                    <div
                        class="tv-epg-guide-row__now-line"
                        [style.left.%]="now"
                    ></div>
                }
                @if (blocks().length === 0) {
                    <div class="tv-epg-guide-row__no-data">
                        No programme information
                    </div>
                } @else {
                    @for (
                        block of blocks();
                        track block.program.start;
                        let i = $index
                    ) {
                        <div
                            class="tv-epg-guide-row__block"
                            [class.tv-epg-guide-row__block--focused]="
                                focused() && focusedBlock() === i
                            "
                            [style.left.%]="block.leftPercent"
                            [style.width.%]="block.widthPercent"
                        >
                            {{ block.program.title }}
                        </div>
                    }
                }
            </div>
        </div>
    `,
    styles: [
        `
            .tv-epg-guide-row {
                display: flex;
                align-items: stretch;
                gap: 16px;
                border-radius: 12px;
                padding: 6px 12px;

                &--focused {
                    background: var(--tv-panel-focused-tint);
                }

                &__channel {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    width: 180px;
                    flex-shrink: 0;
                }

                &__badge {
                    width: 36px;
                    height: 36px;
                    border-radius: 8px;
                    background: var(--tv-muted-card-fill);
                    color: var(--tv-text-body-muted);
                    flex-shrink: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 13px;
                    font-weight: 700;
                }

                &__name {
                    font-size: 15px;
                    color: var(--tv-text-body-muted);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                &--focused &__name {
                    font-weight: 600;
                    color: var(--tv-text-heading);
                }

                &__timeline {
                    position: relative;
                    flex-grow: 1;
                    min-height: 48px;
                }

                &__now-line {
                    position: absolute;
                    top: 0;
                    bottom: 0;
                    width: 2px;
                    background: var(--tv-live);
                    z-index: 1;
                }

                &__no-data {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    font-size: 13px;
                    color: var(--tv-text-dim);
                }

                &__block {
                    position: absolute;
                    top: 4px;
                    bottom: 4px;
                    border-radius: 8px;
                    background: var(--tv-muted-card-fill);
                    color: var(--tv-text-body-muted);
                    font-size: 13px;
                    padding: 6px 10px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    box-sizing: border-box;

                    &--focused {
                        background: var(--tv-accent);
                        color: var(--tv-accent-on);
                    }
                }
            }
        `,
    ],
})
export class TvEpgGuideRowComponent {
    readonly channel = input.required<TvEpgGuideChannel>();
    readonly programs = input<readonly EpgProgram[]>([]);
    readonly windowFromMs = input.required<number>();
    readonly windowToMs = input.required<number>();
    readonly nowMs = input<number | null>(null);
    readonly focused = input(false);
    /** Focused block index within THIS row, or null when the whole row is
     * focused (no specific block). */
    readonly focusedBlock = input<number | null>(null);

    protected readonly initialsOf = channelInitials;

    protected readonly blocks = computed<EpgGuideBlockView[]>(() => {
        const fromMs = this.windowFromMs();
        const toMs = this.windowToMs();
        return this.programs()
            .map((program) => {
                const layout = computeEpgGuideBlockLayout(program, fromMs, toMs);
                return layout ? { program, ...layout } : null;
            })
            .filter((block): block is EpgGuideBlockView => block !== null);
    });

    protected readonly nowPercent = computed(() => {
        const nowMs = this.nowMs();
        if (nowMs === null) {
            return null;
        }
        return computeEpgGuideNowPercent(
            nowMs,
            this.windowFromMs(),
            this.windowToMs()
        );
    });
}
