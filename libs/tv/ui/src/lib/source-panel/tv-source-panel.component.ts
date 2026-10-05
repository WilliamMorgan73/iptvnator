import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    effect,
    inject,
    input,
} from '@angular/core';
import type { TvLiveSource, TvLiveSourceKind } from '@iptvnator/tv/util';

const SOURCE_KIND_LABEL: Readonly<Record<TvLiveSourceKind, string>> = {
    xtream: 'Xtream',
    stalker: 'Stalker',
    m3u: 'M3U',
};

/**
 * The source-switcher panel — a vertical list of every playlist tv mode can
 * play, same row/focus visual language as `TvChannelListComponent` (left
 * accent bar + tinted background on the focused row, no icons). Slides in
 * over the always-visible category/channel panel rather than living beside
 * it — v1's ~456px panel width has no room for a persistent extra column.
 */
@Component({
    selector: 'app-tv-source-panel',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="tv-source-panel">
            <div class="tv-source-panel__heading">Sources</div>
            @for (source of sources(); track source.id; let i = $index) {
                <div
                    class="tv-source-panel__row"
                    [attr.data-row-index]="i"
                    [class.tv-source-panel__row--focused]="
                        i === focusedIndex()
                    "
                    [class.tv-source-panel__row--active]="
                        source.id === activeSourceId()
                    "
                >
                    <div class="tv-source-panel__body">
                        <div class="tv-source-panel__title">
                            {{ source.title }}
                        </div>
                        <div class="tv-source-panel__kind">
                            {{ kindLabel(source.kind) }}
                        </div>
                    </div>
                    @if (source.id === activeSourceId()) {
                        <div class="tv-source-panel__active-dot"></div>
                    }
                </div>
            }
            <div
                class="tv-source-panel__row tv-source-panel__row--add"
                [attr.data-row-index]="sources().length"
                [class.tv-source-panel__row--focused]="
                    sources().length === focusedIndex()
                "
            >
                <div class="tv-source-panel__body">
                    <div class="tv-source-panel__title">+ Add source</div>
                </div>
            </div>
        </div>
    `,
    styles: [
        `
            .tv-source-panel {
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

                &__row {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 14px 22px;
                    border-radius: 14px;

                    &--focused {
                        background: var(--tv-panel-focused-tint);
                        border-left: 4px solid var(--tv-accent);
                        margin-left: -4px;
                        padding-left: 18px;
                    }

                    &--add {
                        border: 1px dashed var(--tv-text-hint);
                    }
                }

                &__body {
                    flex-grow: 1;
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                &__title {
                    font-size: 18px;
                    color: var(--tv-text-body-muted);
                }

                &__row--focused &__title {
                    font-weight: 600;
                    color: var(--tv-text-heading);
                }

                &__row--add &__title {
                    color: var(--tv-text-dim);
                }

                &__kind {
                    font-size: 13px;
                    color: var(--tv-text-dim);
                }

                &__row--focused &__kind {
                    color: var(--tv-text-body-muted);
                }

                &__active-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: var(--tv-accent);
                    flex-shrink: 0;
                }
            }
        `,
    ],
})
export class TvSourcePanelComponent {
    readonly sources = input.required<readonly TvLiveSource[]>();
    readonly activeSourceId = input<string | null>(null);
    readonly focusedIndex = input<number | null>(null);

    kindLabel(kind: TvLiveSourceKind): string {
        return SOURCE_KIND_LABEL[kind];
    }

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
                        '.tv-source-panel'
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
