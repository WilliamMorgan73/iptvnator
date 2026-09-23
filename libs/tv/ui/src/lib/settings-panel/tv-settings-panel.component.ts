import { ChangeDetectionStrategy, Component, input } from '@angular/core';
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
            .tv-settings-panel {
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
}
