import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    effect,
    inject,
    input,
} from '@angular/core';
import type { TvLiveCategory } from '@iptvnator/tv/util';

@Component({
    selector: 'app-tv-category-pills',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="tv-category-pills">
            @for (category of categories(); track category.id; let i = $index) {
                <div
                    class="tv-category-pills__pill"
                    [attr.data-pill-index]="i"
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
                overflow-x: auto;
                overflow-y: hidden;
                flex-shrink: 0;
                scrollbar-width: none;

                &::-webkit-scrollbar {
                    display: none;
                }

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

    private readonly hostEl = inject(ElementRef<HTMLElement>);

    /**
     * Keeps the focused pill on screen — `.tv-category-pills` scrolls but
     * has no native focus for the browser to follow (the signal-driven
     * `focusedIndex` is the only source of truth, per the tv-mode focus
     * engine). Mirrors the scroll-into-view math
     * `WorkspaceContextCategoryViewComponent` already uses for the desktop
     * categories rail (vertical there, horizontal here).
     */
    constructor() {
        effect(() => {
            const index = this.focusedIndex();
            if (index === null) {
                return;
            }

            queueMicrotask(() => {
                const container = this.hostEl.nativeElement.querySelector(
                    '.tv-category-pills'
                );
                const pill = container?.querySelector(
                    `[data-pill-index="${index}"]`
                );
                // `scrollTo` is unimplemented in some non-browser DOM
                // environments (e.g. jsdom) — never let this best-effort
                // scroll throw out of a microtask, which real browsers never
                // reach anyway.
                if (
                    !container ||
                    !pill ||
                    typeof container.scrollTo !== 'function'
                ) {
                    return;
                }

                const containerRect = container.getBoundingClientRect();
                const pillRect = pill.getBoundingClientRect();
                const targetLeft =
                    container.scrollLeft +
                    (pillRect.left - containerRect.left) -
                    container.clientWidth / 2 +
                    pillRect.width / 2;
                const maxScrollLeft = Math.max(
                    0,
                    container.scrollWidth - container.clientWidth
                );

                container.scrollTo({
                    left: Math.min(maxScrollLeft, Math.max(0, targetLeft)),
                });
            });
        });
    }
}
