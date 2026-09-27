import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    inject,
    input,
    signal,
} from '@angular/core';

/**
 * Small, PERSISTENT corner badge while a recording is active — deliberately
 * not `TvPlaybackHudComponent` or a new HUD `kind`: the HUD is transient and
 * fades after ~1.5s, wrong shape for a state that must stay visible for the
 * whole recording. Owns its own 1s tick for the elapsed-time readout, same
 * "each component owns its own render-refresh timer" precedent as the shell's
 * clock badge (30s tick) — no dependency on the shell's own timers.
 * Positioned below the clock badge and the digit-entry overlay, stacking the
 * top-right "status area" rather than overlapping either.
 */
@Component({
    selector: 'app-tv-recording-indicator',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        @if (startedAt(); as startedAtValue) {
            <div class="tv-recording-indicator">
                <span class="tv-recording-indicator__dot"></span>
                <span class="tv-recording-indicator__label"
                    >{{ elapsedLabel(startedAtValue) }}</span
                >
            </div>
        }
    `,
    styles: [
        `
            .tv-recording-indicator {
                position: absolute;
                top: 156px;
                right: 48px;
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 16px;
                border-radius: 999px;
                background: rgba(13, 15, 18, 0.72);
                color: var(--tv-text-heading);
                font-size: 14px;
                font-weight: 600;
                font-variant-numeric: tabular-nums;

                &__dot {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    background: var(--tv-live);
                }
            }
        `,
    ],
})
export class TvRecordingIndicatorComponent {
    /** ISO start time, or `null`/undefined while nothing is recording. */
    readonly startedAt = input<string | null | undefined>(null);

    private readonly tick = signal(Date.now());

    constructor() {
        const intervalId = setInterval(() => this.tick.set(Date.now()), 1000);
        inject(DestroyRef).onDestroy(() => clearInterval(intervalId));
    }

    elapsedLabel(startedAtIso: string): string {
        this.tick(); // re-evaluate every second
        const elapsedMs = Math.max(0, Date.now() - Date.parse(startedAtIso));
        const totalSeconds = Math.floor(elapsedMs / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const pad = (value: number) => String(value).padStart(2, '0');
        return hours > 0
            ? `${hours}:${pad(minutes)}:${pad(seconds)}`
            : `${minutes}:${pad(seconds)}`;
    }
}
