import { Routes } from '@angular/router';
import { TvLiveScreenComponent } from '@iptvnator/tv/shell/feature';

// v1 is functionally one screen; the router stays in place because VOD and
// Settings will want routes later (.plans/2026-09-20-tv-controller-app.md,
// "Screens").
export const appRoutes: Routes = [
    { path: '', component: TvLiveScreenComponent },
];
