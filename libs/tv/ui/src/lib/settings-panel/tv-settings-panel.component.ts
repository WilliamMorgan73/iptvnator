import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    effect,
    inject,
    input,
} from '@angular/core';
import type { TvSettingsItem } from '@iptvnator/tv/util';

/**
 * The settings panel — a vertical list of the curated, D-pad-navigable
 * settings tv mode exposes (see `resolveTvSettingsItems`'s doc comment for
 * why it's a short list, not all of `apps/web`'s Settings sections). Same
 * row/focus visual language as `TvSourcePanelComponent`/`TvChannelListComponent`
 * (left accent bar + tinted background on the focused row); unlike those,
 * each row also shows its current value with a left/right hint, since a
 * settings row is adjusted in place rather than activated.
 */
@Component({
    selector: 'app-tv-settings-panel',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="tv-settings-panel">
            <div class="tv-settings-panel__heading">Settings</div>
            @for (item of items(); track item.id; let i = $index) {
                <div
                    class="tv-settings-panel__row"
                    [attr.data-row-index]="i"
                    [class.tv-settings-panel__row--focused]="
                        i === focusedIndex()
                    "
                >
                    <div class="tv-settings-panel__label">
                        {{ item.label }}
                    </div>
                    <div class="tv-settings-panel__value">
                        @if (i === focusedIndex()) {
                            <span class="tv-settings-panel__arrow">◄</span>
                        }
                        {{ item.valueLabel }}
                        @if (i === focusedIndex()) {
                            <span class="tv-settings-panel__arrow">►</span>
                        }
                    </div>
                </div>
            }
        </div>
    `,
    styles: [
        `
            // The host is a flex item of the live screen's panel column;
            // flex: 1 + min-height: 0 clamp it to the panel's height so the
            // inner list below overflows and scrolls instead of growing past
            // the bottom of the screen — see TvCategoryListComponent's :host.
            :host {
                display: flex;
                flex-direction: column;
                flex: 1;
                min-height: 0;
            }

            .tv-settings-panel {
                flex: 1;
                min-height: 0;
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
                    justify-content: space-between;
                    gap: 12px;
                    padding: 14px 22px;
                    border-radius: 14px;

                    &--focused {
                        background: var(--tv-panel-focused-tint);
                        border-left: 4px solid var(--tv-accent);
                        margin-left: -4px;
                        padding-left: 18px;
                    }
                }

                &__label {
                    font-size: 18px;
                    color: var(--tv-text-body-muted);
                    min-width: 0;
                }

                &__row--focused &__label {
                    font-weight: 600;
                    color: var(--tv-text-heading);
                }

                &__value {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 15px;
                    color: var(--tv-text-dim);
                    flex-shrink: 0;
                    white-space: nowrap;
                }

                &__row--focused &__value {
                    color: var(--tv-accent);
                }

                &__arrow {
                    font-size: 13px;
                }
            }
        `,
    ],
})
export class TvSettingsPanelComponent {
    readonly items = input.required<readonly TvSettingsItem[]>();
    readonly focusedIndex = input<number | null>(null);

    private readonly hostEl = inject<ElementRef<HTMLElement>>(ElementRef);

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
                        '.tv-settings-panel'
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
