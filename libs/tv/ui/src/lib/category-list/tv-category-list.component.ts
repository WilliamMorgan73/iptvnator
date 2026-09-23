import { ChangeDetectionStrategy, Component, input } from '@angular/core';
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
}
