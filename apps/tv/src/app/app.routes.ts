import { Routes } from '@angular/router';
import { resolveTvStartScreenPath } from './resolve-tv-start-screen-path';

// Three screens: Live, Add Source, and Dashboard. `''` has no component of
// its own — it redirects to whichever of `/live`/`/dashboard`
// `Settings.tvStartScreen` names, re-resolved on every `''` navigation
// (harmless: nothing besides initial load ever targets `''` once the named
// routes exist). Every other screen links to the stable `/live`/`/dashboard`
// paths directly, never `''`.
export const appRoutes: Routes = [
    { path: '', pathMatch: 'full', redirectTo: () => resolveTvStartScreenPath() },
    {
        path: 'dashboard',
        loadComponent: () =>
            import('@iptvnator/tv/shell/feature').then(
                (m) => m.TvDashboardScreenComponent
            ),
    },
    {
        path: 'live',
        loadComponent: () =>
            import('@iptvnator/tv/shell/feature').then(
                (m) => m.TvLiveScreenComponent
            ),
    },
    {
        path: 'add-source',
        loadComponent: () =>
            import('@iptvnator/tv/shell/feature').then(
                (m) => m.TvAddSourceScreenComponent
            ),
    },
];
