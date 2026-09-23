import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    effect,
    inject,
    input,
} from '@angular/core';
import type { TvLiveCategory } from '@iptvnator/tv/util';

/**
 * Vertical category rail for grid browse mode — full-screen grid tiles need
 * the category picker beside them rather than above, unlike
 * `TvCategoryPillsComponent`'s horizontal row for list mode. Same
 * focused/selected row visual language as `TvSourcePanelComponent`/
 * `TvSettingsPanelComponent` (left accent bar + tinted background on the
 * focused row, filled pill for the confirmed selection).
 */
@Component({
    selector: 'app-tv-category-list',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="tv-category-list">
            @for (category of categories(); track category.id; let i = $index) {
                <div
                    class="tv-category-list__row"
                    [attr.data-row-index]="i"
                    [class.tv-category-list__row--focused]="
                        paneActive() && i === focusedIndex()
                    "
                    [class.tv-category-list__row--selected]="
                        category.id === selectedCategoryId()
                    "
                >
                    {{ category.name }}
                </div>
            }
        </div>
    `,
    styles: [
        `
            // Unstyled custom elements default to display: inline, which
            // breaks height/flex participation with the shell's grid
            // layout — see TvChannelGridComponent's :host for the same fix.
            :host {
                display: block;
                height: 100%;
                min-height: 0;
                overflow-y: auto;
                scrollbar-width: none;

                &::-webkit-scrollbar {
                    display: none;
                }
            }

            .tv-category-list {
                display: flex;
                flex-direction: column;
                gap: 6px;

                &__row {
                    padding: 12px 18px;
                    border-radius: 999px;
                    color: var(--tv-text-dim);
                    font-size: 16px;

                    &--selected {
                        background: var(--tv-accent);
                        color: var(--tv-accent-on);
                        font-weight: 600;
                    }

                    &--focused {
                        box-shadow: 0 0 0 2px var(--tv-accent);
                    }
                }
            }
        `,
    ],
})
export class TvCategoryListComponent {
    readonly categories = input.required<readonly TvLiveCategory[]>();
    readonly selectedCategoryId = input<string | null>(null);
    readonly focusedIndex = input<number | null>(null);
    readonly paneActive = input<boolean>(false);

    private readonly hostEl = inject(ElementRef<HTMLElement>);

    /** Keeps the focused row on screen as focus moves past the visible
     * area — the host itself scrolls (see the `:host` styles above), and
     * has no native focus for the browser to follow, since the
     * signal-driven `focusedIndex` is the only source of truth per the
     * tv-mode focus engine. Same vertical math `TvChannelGridComponent`
     * uses, itself mirroring `TvCategoryPillsComponent`'s horizontal one. */
    constructor() {
        effect(() => {
            const index = this.focusedIndex();
            if (index === null) {
                return;
            }

            queueMicrotask(() => {
                const container = this.hostEl.nativeElement;
                const row = container.querySelector(
                    `[data-row-index="${index}"]`
                );
                if (!row || typeof container.scrollTo !== 'function') {
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
