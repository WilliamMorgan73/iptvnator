import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import {
    closeElectronApp,
    expect,
    launchElectronApp,
    openSettings,
    openSettingsSection,
    restartElectronApp,
    saveSettings,
    test,
} from './electron-test-fixtures';

/**
 * `Settings.tvMode` picks which renderer bundle (`apps/web` or `apps/tv`)
 * the main window loads — chosen before any renderer exists to ask, so it
 * only takes effect on the next launch (same contract as
 * `Settings.startupWindowMode`). `apps/web/src/index.html` and
 * `apps/tv/src/index.html` have different static `<title>`s ("IPTVnator" vs
 * "IPTVnator TV"), which is a reliable, credential-free way to tell which
 * bundle actually loaded without depending on either app's DOM structure.
 */
test.describe('Electron TV mode', () => {
    test('@settings @persistence @electron toggling TV mode switches the loaded renderer bundle on restart, in both directions', async ({
        dataDir,
    }) => {
        let app = await launchElectronApp(dataDir);

        try {
            expect(await app.mainWindow.title()).toBe('IPTVnator');

            await openSettings(app.mainWindow);
            await openSettingsSection(app.mainWindow, 'general');
            await expect(
                app.mainWindow.getByTestId('tv-mode-setting')
            ).toBeVisible();

            await app.mainWindow
                .getByTestId('tv-mode-toggle')
                .locator('input')
                .check();
            await saveSettings(app.mainWindow);

            // Read at window creation only — the already-running window
            // keeps showing apps/web until the next launch.
            expect(await app.mainWindow.title()).toBe('IPTVnator');
        } finally {
            app = await restartElectronApp(app, dataDir);
        }

        try {
            await expect
                .poll(() => app.mainWindow.title(), { timeout: 10_000 })
                .toBe('IPTVnator TV');
        } finally {
            // apps/tv has no in-app Settings screen in v1 (out of scope —
            // live TV only), so flip the flag back off directly in the
            // mirrored main-process config file, the same one the
            // SETTINGS_UPDATE handler writes to. Close the running app FIRST:
            // its own shutdown hooks (window-bounds/zoom persistence) write
            // the whole config back from their in-memory copy, which would
            // otherwise clobber an edit made while the process is still alive.
            await closeElectronApp(app);
            await setTvModeInMainProcessConfig(dataDir, false);
            app = await launchElectronApp(dataDir);
        }

        try {
            // Confirms apps/web is unregressed by this feature: it loads and
            // renders its normal settings UI exactly as before. The renderer's
            // own persisted `Settings.tvMode` (IndexedDB, seeded on Save) still
            // reads true here — only the main-process renderer-selection
            // mirror was edited directly above, which is the actual
            // limitation this test is deliberately working around (apps/tv
            // has no Settings screen of its own in v1 to uncheck it through
            // the normal flow) — so the checkbox state is not asserted here.
            await expect
                .poll(() => app.mainWindow.title(), { timeout: 10_000 })
                .toBe('IPTVnator');
            await openSettings(app.mainWindow);
            await openSettingsSection(app.mainWindow, 'general');
            await expect(
                app.mainWindow.getByTestId('tv-mode-setting')
            ).toBeVisible();
        } finally {
            await closeElectronApp(app);
        }
    });
});

async function setTvModeInMainProcessConfig(
    dataDir: string,
    tvMode: boolean
): Promise<void> {
    const configPath = join(dataDir, 'config', 'config.json');
    const config = JSON.parse(await readFile(configPath, 'utf8')) as Record<
        string,
        unknown
    >;
    config['TV_MODE'] = tvMode;
    await writeFile(configPath, JSON.stringify(config), 'utf8');
}
