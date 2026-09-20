import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { TvLiveCategory } from '@iptvnator/tv/util';

@Component({
    selector: 'app-tv-category-pills',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="tv-category-pills">
            @for (category of categories(); track category.id; let i = $index) {
                <div
                    class="tv-category-pills__pill"
                    [class.tv-category-pills__pill--selected]="
                        category.id === selectedCategoryId()
                    "
                    [class.tv-category-pills__pill--focused]="
                        paneActive() && i === focusedIndex()
                    "
                >
                    {{ category.name }}
                </div>
            }
        </div>
    `,
    styles: [
        `
            .tv-category-pills {
                display: flex;
                gap: 10px;
                padding-right: 36px;
                overflow: hidden;
                flex-shrink: 0;

                &__pill {
                    padding: 9px 18px;
                    border-radius: 999px;
                    color: var(--tv-text-dim);
                    font-size: 16px;
                    white-space: nowrap;

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
export class TvCategoryPillsComponent {
    readonly categories = input.required<readonly TvLiveCategory[]>();
    readonly selectedCategoryId = input<string | null>(null);
    readonly focusedIndex = input<number | null>(null);
    readonly paneActive = input<boolean>(false);
}
