import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    effect,
    inject,
    input,
} from '@angular/core';
import type { RecordingItem } from '@iptvnator/services';
import { channelInitials } from '@iptvnator/tv/util';

/**
 * The Recordings pane — same heading/row-list shell as `TvRecentPanelComponent`/
 * `TvSourcePanelComponent`. Play-only in v1 (activating a row plays it, no
 * gamepad/keyboard budget spent on a second "delete" action from a remote —
 * removing a recording stays a desktop-app task via its own Recordings
 * manager). A row still being written (`status === 'recording'`) is shown
 * but not activatable, since its file is incomplete.
 */
@Component({
    selector: 'app-tv-recordings-panel',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="tv-recordings-panel">
            <div class="tv-recordings-panel__heading">Recordings</div>
            @if (recordings().length === 0) {
                <p class="tv-recordings-panel__empty">No recordings yet</p>
            } @else {
                @for (
                    recording of recordings();
                    track recording.id;
                    let i = $index
                ) {
                    <div
                        class="tv-recordings-panel__row"
                        [attr.data-row-index]="i"
                        [class.tv-recordings-panel__row--focused]="
                            i === focusedIndex()
                        "
                        [class.tv-recordings-panel__row--recording]="
                            recording.status === 'recording'
                        "
                    >
                        <div class="tv-recordings-panel__badge">
                            {{ initialsOf(recording.channelName) }}
                        </div>
                        <div class="tv-recordings-panel__body">
                            <div class="tv-recordings-panel__name">
                                {{ recording.channelName }}
                            </div>
                            <div class="tv-recordings-panel__status">
                                {{ statusLabel(recording) }}
                            </div>
                        </div>
                    </div>
                }
            }
        </div>
    `,
    styles: [
        `
            .tv-recordings-panel {
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

                &__empty {
                    margin: 0;
                    padding: 24px 22px;
                    font-size: 15px;
                    color: var(--tv-text-dim);
                }

                &__row {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 14px 22px;
                    border-radius: 14px;

                    &--focused {
                        background: var(--tv-panel-focused-tint);
                        border-left: 4px solid var(--tv-accent);
                        margin-left: -4px;
                        padding-left: 18px;
                    }
                }

                &__badge {
                    width: 46px;
                    height: 46px;
                    border-radius: 10px;
                    background: var(--tv-muted-card-fill);
                    color: var(--tv-text-body-muted);
                    flex-shrink: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 15px;
                    font-weight: 700;
                }

                &__row--focused &__badge {
                    background: var(--tv-accent);
                    color: var(--tv-accent-on);
                }

                &__body {
                    flex-grow: 1;
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 5px;
                }

                &__name {
                    font-size: 18px;
                    color: var(--tv-text-body-muted);
                }

                &__row--focused &__name {
                    font-weight: 600;
                    color: var(--tv-text-heading);
                }

                &__status {
                    font-size: 13px;
                    color: var(--tv-text-dim);
                }

                &__row--focused &__status {
                    color: var(--tv-text-body-muted);
                }

                &__row--recording &__status {
                    color: var(--tv-live);
                }
            }
        `,
    ],
})
export class TvRecordingsPanelComponent {
    readonly recordings = input.required<readonly RecordingItem[]>();
    readonly focusedIndex = input<number | null>(null);

    protected readonly initialsOf = channelInitials;

    private readonly hostEl = inject(ElementRef<HTMLElement>);

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
                        '.tv-recordings-panel'
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

    statusLabel(recording: RecordingItem): string {
        if (recording.status === 'recording') {
            return 'Recording…';
        }
        const date = new Date(recording.startedAt).toLocaleDateString([], {
            month: 'short',
            day: 'numeric',
        });
        if (recording.status === 'failed') {
            return `Failed · ${date}`;
        }
        const label = recording.status === 'interrupted' ? 'Partial' : 'Ready';
        return `${label} · ${date}`;
    }
}
