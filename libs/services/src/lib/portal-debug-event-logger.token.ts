import { InjectionToken } from '@angular/core';

/**
 * Pretty-prints a portal debug event (forwarded from the main process) to
 * the renderer console. Optional and callback-based rather than a direct
 * `@iptvnator/portal/shared/util` (`logPortalDebugEvent`) dependency: that
 * lib is `domain:portal-shared`, off limits to this `domain:shared-runtime`
 * lib under the Nx module-boundary rules. Apps that want the dev-only
 * "PortalDebug" console groups (`apps/web` today) provide this in
 * `app.config.ts`, wrapping the real `logPortalDebugEvent`; an app that
 * doesn't provide it simply doesn't get the feature.
 */
export type PortalDebugEventLogger = (event: unknown) => void;

export const PORTAL_DEBUG_EVENT_LOGGER =
    new InjectionToken<PortalDebugEventLogger>('PORTAL_DEBUG_EVENT_LOGGER');
