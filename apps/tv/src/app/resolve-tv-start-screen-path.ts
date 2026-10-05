import { inject } from '@angular/core';
import { SettingsStore } from '@iptvnator/services';

/**
 * The root route's redirect target — `Settings.tvStartScreen` (default
 * `'live'`) decides whether launching `apps/tv` opens Live TV or the
 * Dashboard. Kept as its own function so it has a direct unit test rather
 * than only being exercised through Angular's router harness.
 */
export function resolveTvStartScreenPath(): string {
    const startScreen = inject(SettingsStore).getSettings().tvStartScreen;
    return startScreen === 'dashboard' ? '/dashboard' : '/live';
}
