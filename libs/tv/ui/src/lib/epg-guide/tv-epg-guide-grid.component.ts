import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { parseEpgDateKey } from '@iptvnator/ui/epg';
import type { EpgProgram } from '@iptvnator/shared/interfaces';
import type { TvEpgGuideChannel, TvEpgGuideFocus } from '@iptvnator/tv/util';
import { TvEpgGuideRowComponent } from './tv-epg-guide-row.component';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The guide grid host: a date header and one `TvEpgGuideRowComponent` per
 * channel. Owns only display concerns (day-window math, "now" position,
 * loading/empty states) — all navigation state lives in the shell-owned
 * `TvEpgGuideController`/`TvEpgGuideFocusController`, passed in as plain
 * inputs so this component stays a pure renderer, same split as
 * `TvSourcePanelComponent`/`TvRecentPanelComponent`.
 */
@Component({
    selector: 'app-tv-epg-guide-grid',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [TvEpgGuideRowComponent],
    template: `
        <div class="tv-epg-guide-grid">
            <div class="tv-epg-guide-grid__header">
                <div class="tv-epg-guide-grid__title">{{ titleLabel() }}</div>
                <div class="tv-epg-guide-grid__date">{{ dateLabel() }}</div>
            </div>
            @if (loading() && channels().length === 0) {
                <p class="tv-epg-guide-grid__empty">Loading guide…</p>
            } @else if (channels().length === 0) {
                <p class="tv-epg-guide-grid__empty">
                    No channels available for the guide
                </p>
            } @else {
                <div class="tv-epg-guide-grid__rows">
                    @for (
                        channel of channels();
                        track channel.id;
                        let i = $index
                    ) {
                        <app-tv-epg-guide-row
                            [channel]="channel"
                            [programs]="programsFor(channel.id)"
                            [windowFromMs]="windowFromMs()"
                            [windowToMs]="windowToMs()"
                            [nowMs]="nowMs()"
                            [focused]="focus()?.row === i"
                            [focusedBlock]="
                                focus()?.row === i ? (focus()?.block ?? null) : null
                            "
                        />
                    }
                </div>
            }
        </div>
    `,
    styles: [
        `
            .tv-epg-guide-grid {
                display: flex;
                flex-direction: column;
                gap: 12px;
                height: 100%;
                overflow: hidden;

                &__header {
                    display: flex;
                    align-items: baseline;
                    justify-content: space-between;
                    padding: 0 22px;
                }

                &__title {
                    font-size: 13px;
                    font-weight: 600;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    color: var(--tv-text-dim);
                }

                &__date {
                    font-size: 15px;
                    font-weight: 600;
                    color: var(--tv-text-heading);
                }

                &__empty {
                    margin: 0;
                    padding: 24px 22px;
                    font-size: 15px;
                    color: var(--tv-text-dim);
                }

                &__rows {
                    flex-grow: 1;
                    overflow-y: auto;
                    overflow-x: hidden;
                    scrollbar-width: none;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    padding: 0 22px 12px;

                    &::-webkit-scrollbar {
                        display: none;
                    }
                }
            }
        `,
    ],
})
export class TvEpgGuideGridComponent {
    readonly channels = input.required<readonly TvEpgGuideChannel[]>();
    readonly programsByChannelId = input.required<
        ReadonlyMap<string, EpgProgram[]>
    >();
    readonly dateKey = input.required<string>();
    readonly loading = input(false);
    readonly focus = input<TvEpgGuideFocus | null>(null);
    readonly nowMs = input<number>(Date.now());
    /** The category the shown channels were narrowed to, if any — appended
     * to the "Guide" title so it's clear the list isn't the whole source. */
    readonly categoryName = input<string | null>(null);

    protected readonly titleLabel = computed(() => {
        const name = this.categoryName();
        return name ? `Guide · ${name}` : 'Guide';
    });

    protected readonly windowFromMs = computed(() =>
        parseEpgDateKey(this.dateKey()).getTime()
    );
    protected readonly windowToMs = computed(
        () => this.windowFromMs() + ONE_DAY_MS
    );

    protected readonly dateLabel = computed(() =>
        parseEpgDateKey(this.dateKey()).toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
        })
    );

    protected programsFor(channelId: string): readonly EpgProgram[] {
        return this.programsByChannelId().get(channelId) ?? [];
    }
}
