import { InjectionToken } from '@angular/core';

/**
 * The subset of an app's build-time `environment.ts` that shared Electron
 * data-access code needs. Each Electron-capable app (`apps/web`, `apps/tv`)
 * provides its own value from its own `environment.ts` in its `app.config.ts`
 * — this token exists so `ElectronService` can live in a shared lib without
 * a relative import into one specific app's `environments/` folder.
 */
export interface AppEnvironmentConfig {
    readonly production: boolean;
    readonly version: string;
}

export const APP_CONFIG = new InjectionToken<AppEnvironmentConfig>(
    'APP_CONFIG'
);
