import { Injectable, signal } from '@angular/core';

export type TvPendingPane = 'sources' | 'recent' | 'recordings' | 'settings';

/** Structural, not `TvLivePanesController` itself — `data-access` cannot
 * depend on the `shell/feature` project that owns it (Nx boundaries), and
 * every pane this service can request happens to be a zero-arg toggle. */
export interface TvPendingPaneTarget {
    onToggleSources(): void;
    onToggleRecent(): void;
    onToggleRecordings(): void;
    onToggleSettings(): void;
}

/**
 * Lets the Dashboard screen ask the Live TV screen to open one of its panes
 * on arrival, even though the two live at separate routes and
 * `TvLivePanesController` only exists once `TvLiveScreenComponent` is
 * constructed. A plain signal (not router navigation `state`) matches every
 * other piece of cross-cutting tv-mode state in this codebase and is
 * trivially fakeable in specs.
 */
@Injectable({ providedIn: 'root' })
export class TvPendingPaneService {
    private readonly pane = signal<TvPendingPane | null>(null);

    request(pane: TvPendingPane): void {
        this.pane.set(pane);
    }

    /** Reads and clears in one step, so a later plain visit to Live TV never
     * re-opens a stale request. */
    consume(): TvPendingPane | null {
        const value = this.pane();
        this.pane.set(null);
        return value;
    }

    /** Consumes whatever is pending and opens the matching pane, if any —
     * the one call `TvLiveScreenComponent`'s constructor needs. */
    dispatchTo(target: TvPendingPaneTarget): void {
        switch (this.consume()) {
            case 'sources':
                target.onToggleSources();
                break;
            case 'recent':
                target.onToggleRecent();
                break;
            case 'recordings':
                target.onToggleRecordings();
                break;
            case 'settings':
                target.onToggleSettings();
                break;
        }
    }
}
