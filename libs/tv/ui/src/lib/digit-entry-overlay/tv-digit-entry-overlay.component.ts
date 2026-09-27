import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Transient readout for numeric channel entry (`TvDigitEntryController`) —
 * a sibling to `TvPlaybackHudComponent`, not an extra `TvPlaybackHudKind`:
 * the HUD's template is built around a single icon + optional bar, and a
 * multi-digit text readout is a different enough shape that reusing it would
 * couple two unrelated concerns. Visible whenever there are digits to show;
 * the controller owns clearing them (on commit), not this component.
 * Positioned below the top-right clock badge/live indicator — that corner
 * stays clear of the translucent browsing panel (which only spans the left
 * 456px) regardless of pane state, unlike a top-left or bottom placement.
 */
@Component({
    selector: 'app-tv-digit-entry-overlay',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        @if (digits().length > 0) {
            <div class="tv-digit-entry-overlay">{{ digits() }}</div>
        }
    `,
    styles: [
        `
            .tv-digit-entry-overlay {
                position: absolute;
                top: 100px;
                right: 48px;
                min-width: 64px;
                padding: 10px 18px;
                border-radius: 12px;
                background: rgba(13, 15, 18, 0.72);
                color: var(--tv-text-heading);
                font-size: 28px;
                font-weight: 600;
                letter-spacing: 0.08em;
                text-align: center;
            }
        `,
    ],
})
export class TvDigitEntryOverlayComponent {
    readonly digits = input<string>('');
}
