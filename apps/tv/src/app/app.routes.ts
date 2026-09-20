import { Routes } from '@angular/router';
import { TvLiveScreenComponent } from '@iptvnator/tv/shell/feature';
import { AddSourceComponent } from './add-source/add-source.component';

// v1 is functionally one screen; the router stays in place because VOD and
// Settings will want routes later (.plans/2026-09-20-tv-controller-app.md,
// "Screens"). /add-source is a dev/test-only exception to that, not a v1
// design element — see AddSourceComponent's doc comment.
export const appRoutes: Routes = [
    { path: '', component: TvLiveScreenComponent },
    { path: 'add-source', component: AddSourceComponent },
];
