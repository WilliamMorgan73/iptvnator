import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * The only chrome left on screen once the panel auto-hides: a barely-visible
 * left-edge gradient plus a hint that any D-pad input brings the list back.
 */
@Component({
    selector: 'app-tv-immersive-hint',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="tv-immersive-hint__edge"></div>
        <div class="tv-immersive-hint__text">Press left for channels</div>
    `,
    styles: [
        `
            :host {
                position: absolute;
                inset: 0;
                pointer-events: none;
            }

            .tv-immersive-hint__edge {
                position: absolute;
                top: 0;
                left: 0;
                bottom: 0;
                width: 10px;
                background: linear-gradient(
                    90deg,
                    rgba(120, 173, 255, 0.16) 0%,
                    rgba(120, 173, 255, 0) 100%
                );
            }

            .tv-immersive-hint__text {
                position: absolute;
                bottom: 44px;
                left: 48px;
                font-size: 14px;
                color: var(--tv-text-hint);
            }
        `,
    ],
})
export class TvImmersiveHintComponent {}
