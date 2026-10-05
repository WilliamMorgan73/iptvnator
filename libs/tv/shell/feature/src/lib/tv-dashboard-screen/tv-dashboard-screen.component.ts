import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TvKeyboardInputDirective } from '@iptvnator/tv/ui';
import { TvPendingPaneService } from '@iptvnator/tv/data-access';
import type { GridFocusDirection } from '@iptvnator/tv/util';
import {
    TvDashboardController,
    type TvDashboardEntry,
} from './tv-dashboard.controller';

const ENTRIES: readonly TvDashboardEntry[] = [
    { id: 'live', label: 'Live TV' },
    { id: 'recent', label: 'Recently Viewed' },
    { id: 'recordings', label: 'Recordings' },
    { id: 'sources', label: 'Sources' },
    { id: 'add-source', label: 'Add a source' },
    { id: 'settings', label: 'Settings' },
];

/**
 * The Dashboard screen — a dedicated, opaque full screen (no live video
 * behind it, same shape as `TvAddSourceScreenComponent`), reachable from
 * Live TV's Home input and optionally `Settings.tvStartScreen`'s launch
 * target. Sources/Recent/Recordings/Settings live only as panes inside Live
 * TV, so those four entries hand off via `TvPendingPaneService` and navigate
 * to `/live` rather than duplicating that UI here.
 */
@Component({
    selector: 'app-tv-dashboard-screen',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [TvKeyboardInputDirective],
    templateUrl: './tv-dashboard-screen.component.html',
    styleUrls: ['./tv-dashboard-screen.component.scss'],
})
export class TvDashboardScreenComponent {
    private readonly router = inject(Router);
    private readonly pendingPane = inject(TvPendingPaneService);

    protected readonly entries = ENTRIES;

    protected readonly controller = new TvDashboardController({
        entries: () => ENTRIES,
        onSelect: (entry) => this.select(entry),
        onExit: () => void this.router.navigateByUrl('/live'),
    });

    protected onDirection(direction: GridFocusDirection): void {
        this.controller.onDirection(direction);
    }

    protected onActivate(): void {
        this.controller.onActivate();
    }

    protected onBack(): void {
        this.controller.onBack();
    }

    private select(entry: TvDashboardEntry): void {
        switch (entry.id) {
            case 'live':
                void this.router.navigateByUrl('/live');
                break;
            case 'add-source':
                void this.router.navigateByUrl('/add-source');
                break;
            case 'sources':
            case 'recent':
            case 'recordings':
            case 'settings':
                this.pendingPane.request(entry.id);
                void this.router.navigateByUrl('/live');
                break;
        }
    }
}
