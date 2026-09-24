import { Routes } from '@angular/router';
import {
    TvAddSourceScreenComponent,
    TvLiveScreenComponent,
} from '@iptvnator/tv/shell/feature';

// v1 is functionally two screens (Live and Add Source); the router stays in
// place beyond that because VOD and Settings will want routes later
// (.plans/2026-09-20-tv-controller-app.md, "Screens").
export const appRoutes: Routes = [
    { path: '', component: TvLiveScreenComponent },
    { path: 'add-source', component: TvAddSourceScreenComponent },
];
