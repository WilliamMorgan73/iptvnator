import { Routes } from '@angular/router';
import {
    TvAddSourceScreenComponent,
    TvDashboardScreenComponent,
    TvLiveScreenComponent,
} from '@iptvnator/tv/shell/feature';
import { resolveTvStartScreenPath } from './resolve-tv-start-screen-path';

// Three screens: Live, Add Source, and Dashboard. `''` has no component of
// its own — it redirects to whichever of `/live`/`/dashboard`
// `Settings.tvStartScreen` names, re-resolved on every `''` navigation
// (harmless: nothing besides initial load ever targets `''` once the named
// routes exist). Every other screen links to the stable `/live`/`/dashboard`
// paths directly, never `''`.
export const appRoutes: Routes = [
    { path: '', pathMatch: 'full', redirectTo: () => resolveTvStartScreenPath() },
    { path: 'dashboard', component: TvDashboardScreenComponent },
    { path: 'live', component: TvLiveScreenComponent },
    { path: 'add-source', component: TvAddSourceScreenComponent },
];
