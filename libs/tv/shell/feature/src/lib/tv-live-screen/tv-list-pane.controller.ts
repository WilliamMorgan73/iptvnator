import {
    GridFocusController,
    type GridFocusDirection,
} from '@iptvnator/tv/util';

export interface TvListPaneConfig {
    itemCount(): number;
}

/**
 * The "vertical list pane you open and close" shape shared by the source
 * switcher, Recently Viewed, and (a later feature) Recordings panes — each
 * is a `GridFocusController` over a single-column list, opened with an
 * explicit initial focus and otherwise just `move()`/`activate()`
 * passthroughs. `TvLivePanesController` owns WHEN a pane opens/closes
 * (activePane, panelBeforeOverlay) and what its initial focus should be
 * (e.g. the sources pane focusing the currently active source, an empty
 * list focusing nothing) — this class only holds the resulting per-pane grid
 * state, so that decision logic isn't duplicated per pane.
 *
 * Deliberately NOT reused for the settings pane (left/right adjusts a row's
 * value in place rather than activating it) or the category/channel panes
 * (real 2D grid-mode handoffs) — those stay bespoke on
 * `TvLivePanesController`.
 */
export class TvListPaneController {
    private readonly grid: GridFocusController;

    constructor(config: TvListPaneConfig) {
        this.grid = new GridFocusController({
            itemCount: () => config.itemCount(),
            columnCount: () => 1,
        });
    }

    get focusedIndex() {
        return this.grid.focusedIndex;
    }

    /** Called once when the pane opens — `null` focuses nothing (an empty list). */
    open(initialIndex: number | null): void {
        this.grid.focusedIndex.set(initialIndex);
    }

    move(direction: GridFocusDirection): void {
        this.grid.move(direction);
    }

    activate(onActivate: (index: number) => void): void {
        this.grid.activate(onActivate);
    }
}
