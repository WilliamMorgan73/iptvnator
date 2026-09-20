import { InjectionToken } from '@angular/core';

export interface ConfirmDialogOptions {
    readonly title: string;
    readonly message: string;
    readonly confirmLabel: string;
    readonly width?: string;
    readonly onConfirm: () => void;
}

/**
 * Opens a confirm dialog. A plain callback rather than a `DialogService`
 * dependency: `libs/services` is `type:data-access`/`domain:shared-runtime`,
 * which the Nx module-boundary rules forbid from depending on `type:ui`
 * (`@iptvnator/ui/components`, `domain:shared-ui`) — see
 * `docs/architecture/nx-workspace-boundaries.md`. Each Electron-capable app
 * (`apps/web`, `apps/tv`) provides its own implementation in `app.config.ts`,
 * the same escape-hatch pattern already used for `PORTAL_PLAYER` and
 * `FULLSCREEN_CHANNEL_PANEL`.
 */
export type ConfirmDialogOpener = (options: ConfirmDialogOptions) => void;

export const CONFIRM_DIALOG_OPENER = new InjectionToken<ConfirmDialogOpener>(
    'CONFIRM_DIALOG_OPENER'
);
