import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Inline error/status text for the Add Source screen — tv mode has no
 * `MatSnackBar`/toast surface, so a rejected submit (bad URL, portal
 * discovery failure, ...) shows here instead.
 */
@Component({
    selector: 'app-tv-add-source-status',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        @if (message(); as text) {
            <div
                class="tv-add-source-status"
                [class.tv-add-source-status--error]="tone() === 'error'"
            >
                {{ text }}
            </div>
        }
    `,
    styles: [
        `
            .tv-add-source-status {
                padding: 10px 16px;
                border-radius: 10px;
                font-size: 15px;
                background: var(--tv-muted-card-fill);
                color: var(--tv-text-body-muted);

                &--error {
                    color: var(--tv-live);
                }
            }
        `,
    ],
})
export class TvAddSourceStatusComponent {
    readonly message = input<string | null>(null);
    readonly tone = input<'error' | 'info'>('error');
}
