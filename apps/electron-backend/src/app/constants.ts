import { store, TV_MODE } from './services/store.service';

/**
 * The renderer bundle name/port depend on `Settings.tvMode`, mirrored into
 * the main-process store by the `SETTINGS_UPDATE` handler
 * (`events/settings.events.ts`) because the renderer bundle must be chosen
 * before any renderer exists to ask — same pattern as `STARTUP_WINDOW_MODE`.
 * Functions (not constants) so every call site reads the current value
 * instead of one captured at module-load time.
 */
export function getRendererAppName(): string {
    return store.get(TV_MODE, false) ? 'tv' : 'web';
}

export function getRendererAppPort(): number {
    return store.get(TV_MODE, false) ? 4300 : 4200;
}

export const electronAppName = 'iptvnator';
