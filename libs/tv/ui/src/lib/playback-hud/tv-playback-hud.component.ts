import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type TvPlaybackHudKind = 'volume' | 'play-pause';

/**
 * Transient on-screen indicator for volume/play-pause — deliberately not a
 * persistent transport bar (the mockup has none; TiviMate-style live TV
 * doesn't show one). The shell owns visibility and fade timing; this
 * component only renders whatever it's told.
 */
@Component({
    selector: 'app-tv-playback-hud',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div
            class="tv-playback-hud"
            [class.tv-playback-hud--visible]="visible()"
        >
            @if (kind() === 'volume') {
                <svg
                    class="tv-playback-hud__icon"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                >
                    <path
                        d="M4 9v6h4l5 5V4L8 9H4zm11.5 3a4.5 4.5 0 0 0-2.5-4.03v8.06A4.5 4.5 0 0 0 15.5 12z"
                    />
                </svg>
                <div class="tv-playback-hud__bar">
                    <div
                        class="tv-playback-hud__bar-fill"
                        [style.width.%]="volume() * 100"
                    ></div>
                </div>
            } @else {
                <svg
                    class="tv-playback-hud__icon"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                >
                    @if (paused()) {
                        <path d="M8 5v14l11-7z" />
                    } @else {
                        <path d="M6 5h4v14H6zm8 0h4v14h-4z" />
                    }
                </svg>
            }
        </div>
    `,
    styles: [
        `
            .tv-playback-hud {
                position: absolute;
                bottom: 64px;
                left: 50%;
                transform: translateX(-50%);
                display: flex;
                align-items: center;
                gap: 14px;
                padding: 14px 22px;
                border-radius: 999px;
                background: rgba(13, 15, 18, 0.72);
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.2s ease-out;

                &--visible {
                    opacity: 1;
                }

                &__icon {
                    width: 22px;
                    height: 22px;
                    color: var(--tv-accent);
                    flex-shrink: 0;
                }

                &__bar {
                    width: 160px;
                    height: 4px;
                    border-radius: 2px;
                    background: rgba(255, 255, 255, 0.16);
                }

                &__bar-fill {
                    height: 100%;
                    border-radius: 2px;
                    background: var(--tv-accent);
                }
            }
        `,
    ],
})
export class TvPlaybackHudComponent {
    readonly kind = input.required<TvPlaybackHudKind>();
    readonly visible = input<boolean>(false);
    readonly volume = input<number>(0);
    readonly paused = input<boolean>(false);
}
