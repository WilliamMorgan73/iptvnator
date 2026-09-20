import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
    selector: 'app-tv-live-clock-badge',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="tv-live-clock-badge">
            <div class="tv-live-clock-badge__live">
                <span class="tv-live-clock-badge__dot"></span>
                <span>Live</span>
            </div>
            <div class="tv-live-clock-badge__clock">{{ time() }}</div>
        </div>
    `,
    styles: [
        `
            .tv-live-clock-badge {
                display: flex;
                align-items: center;
                gap: 14px;

                &__live {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 5px 12px 5px 9px;
                    border-radius: 999px;
                    background: rgba(255, 143, 143, 0.14);
                    font-size: 14px;
                    font-weight: 600;
                    color: var(--tv-live);
                    letter-spacing: 0.04em;
                }

                &__dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: var(--tv-live);
                    display: inline-block;
                }

                &__clock {
                    font-size: 18px;
                    color: var(--tv-text-body-muted);
                    font-variant-numeric: tabular-nums;
                }
            }
        `,
    ],
})
export class TvLiveClockBadgeComponent {
    readonly time = input.required<string>();
}
