import { ChangeDetectionStrategy, Component, input } from '@angular/core';

const MASKED_CHAR = '•';
const MASKED_VALUE_MAX_LENGTH = 24;

/**
 * A single Add Source form field — label + current value + focus ring, same
 * row/focus visual language as `TvSettingsPanelComponent`. Pure renderer:
 * `TvAddSourceController` owns focus and field values, this only displays
 * them.
 */
@Component({
    selector: 'app-tv-add-source-field-row',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div
            class="tv-add-source-field-row"
            [class.tv-add-source-field-row--focused]="focused()"
        >
            <div class="tv-add-source-field-row__label">{{ label() }}</div>
            <div class="tv-add-source-field-row__value">
                {{ displayValue() }}
            </div>
        </div>
    `,
    styles: [
        `
            .tv-add-source-field-row {
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

                &__label {
                    font-size: 18px;
                    color: var(--tv-text-body-muted);
                    min-width: 0;
                }

                &--focused &__label {
                    font-weight: 600;
                    color: var(--tv-text-heading);
                }

                &__value {
                    font-size: 15px;
                    color: var(--tv-text-dim);
                    flex-shrink: 0;
                    max-width: 50%;
                    overflow: hidden;
                    white-space: nowrap;
                    text-overflow: ellipsis;
                }

                &--focused &__value {
                    color: var(--tv-accent);
                }
            }
        `,
    ],
})
export class TvAddSourceFieldRowComponent {
    readonly label = input.required<string>();
    readonly value = input<string>('');
    readonly masked = input(false);
    readonly focused = input(false);
    readonly placeholder = input<string>('Not set');

    protected displayValue(): string {
        const value = this.value();
        if (!value) {
            return this.placeholder();
        }
        if (!this.masked()) {
            return value;
        }
        return MASKED_CHAR.repeat(
            Math.min(value.length, MASKED_VALUE_MAX_LENGTH)
        );
    }
}
