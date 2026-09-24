import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
    resolveTvKeyboardKeyLabel,
    TV_KEYBOARD_LAYOUT,
} from '@iptvnator/tv/util';

const MASKED_CHAR = '•';
const MASKED_VALUE_MAX_LENGTH = 24;

/**
 * A D-pad-navigable on-screen keyboard: a perfectly rectangular 10×5 grid of
 * same-size keys (`TV_KEYBOARD_LAYOUT`) — no CSS spanning for a wider
 * spacebar, so the grid math stays as simple as `TvChannelGridComponent`'s.
 * Pure renderer, no outputs: unlike the channel grid/category list (whose
 * `focusedIndex` is driven by a shell-owned `GridFocusController`), the host
 * screen's `TvAddSourceController` also owns activation here — it reads
 * `focusedIndex`/`shiftActive` back out to resolve which key was pressed,
 * the same "controller owns everything, component only renders" split
 * `TvLivePanesController` uses for its own panes.
 */
@Component({
    selector: 'app-tv-onscreen-keyboard',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="tv-onscreen-keyboard">
            <div class="tv-onscreen-keyboard__preview">
                {{ previewText() }}
            </div>
            <div class="tv-onscreen-keyboard__grid">
                @for (key of layout; track $index; let i = $index) {
                    <div
                        class="tv-onscreen-keyboard__key"
                        [class.tv-onscreen-keyboard__key--focused]="
                            i === focusedIndex()
                        "
                        [class.tv-onscreen-keyboard__key--control]="
                            key.kind !== 'char'
                        "
                    >
                        {{ keyLabel(key) }}
                    </div>
                }
            </div>
        </div>
    `,
    styles: [
        `
            :host {
                display: block;
            }

            .tv-onscreen-keyboard {
                display: flex;
                flex-direction: column;
                gap: 16px;

                &__preview {
                    min-height: 24px;
                    padding: 10px 16px;
                    border-radius: 10px;
                    background: var(--tv-muted-card-fill);
                    color: var(--tv-text-heading);
                    font-size: 18px;
                    letter-spacing: 0.02em;
                    overflow: hidden;
                    white-space: nowrap;
                    text-overflow: ellipsis;
                }

                &__grid {
                    display: grid;
                    // Column COUNT here must match TV_KEYBOARD_COLUMNS, or
                    // GridFocusController's index math (owned by the host
                    // screen's TvAddSourceController) disagrees with the
                    // rendered layout.
                    grid-template-columns: repeat(10, minmax(0, 1fr));
                    gap: 8px;
                }

                &__key {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 48px;
                    border-radius: 10px;
                    background: var(--tv-muted-card-fill);
                    color: var(--tv-text-body-muted);
                    font-size: 16px;
                    transition:
                        box-shadow 0.1s ease-out,
                        transform 0.1s ease-out;

                    &--control {
                        font-size: 13px;
                        color: var(--tv-text-dim);
                    }

                    &--focused {
                        transform: translateY(-1px);
                        box-shadow: 0 0 0 2px var(--tv-accent);
                        color: var(--tv-text-heading);
                    }
                }
            }
        `,
    ],
})
export class TvOnscreenKeyboardComponent {
    readonly currentValue = input<string>('');
    readonly masked = input(false);
    readonly shiftActive = input(false);
    readonly focusedIndex = input<number | null>(null);

    readonly layout = TV_KEYBOARD_LAYOUT;

    protected keyLabel(key: (typeof TV_KEYBOARD_LAYOUT)[number]): string {
        return resolveTvKeyboardKeyLabel(key, this.shiftActive());
    }

    protected previewText(): string {
        const value = this.currentValue();
        if (!this.masked()) {
            return value || ' ';
        }
        return (
            MASKED_CHAR.repeat(
                Math.min(value.length, MASKED_VALUE_MAX_LENGTH)
            ) || ' '
        );
    }
}
