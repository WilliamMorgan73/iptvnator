import { GridFocusController, type GridFocusDirection } from '@iptvnator/tv/util';

export type TvDashboardEntryId =
    | 'live'
    | 'recent'
    | 'recordings'
    | 'sources'
    | 'add-source'
    | 'settings';

export interface TvDashboardEntry {
    readonly id: TvDashboardEntryId;
    readonly label: string;
}

export interface TvDashboardConfig {
    entries(): readonly TvDashboardEntry[];
    onSelect(entry: TvDashboardEntry): void;
    onExit(): void;
}

/**
 * Owns the Dashboard's own single-column focus over its entry list — same
 * "one DI-free plain controller per screen" convention as
 * `TvAddSourceController`/`TvLivePanesController`, kept even though this
 * screen's own logic is simpler (one list, no region hand-off).
 */
export class TvDashboardController {
    readonly entriesController = new GridFocusController({
        itemCount: () => this.config.entries().length,
        columnCount: () => 1,
    });

    constructor(private readonly config: TvDashboardConfig) {
        this.entriesController.focusedIndex.set(0);
    }

    onDirection(direction: GridFocusDirection): void {
        this.entriesController.move(direction);
    }

    onActivate(): void {
        this.entriesController.activate((index) => {
            const entry = this.config.entries()[index];
            if (entry) {
                this.config.onSelect(entry);
            }
        });
    }

    onBack(): void {
        this.config.onExit();
    }
}
