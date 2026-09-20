declare module '@angular/material/snack-bar' {
    import { Observable } from 'rxjs';

    export interface MatSnackBarRef {
        onAction(): Observable<void>;
    }

    export class MatSnackBar {
        // Loosely typed on purpose: this ambient stub exists because this
        // `type:data-access` lib does not resolve the real, much larger
        // `@angular/material/snack-bar` types (see Nx module-boundary policy
        // in `docs/architecture/nx-workspace-boundaries.md`) — it only needs
        // enough shape to type-check `.open()` call sites. A narrow, exact
        // config shape broke the moment a second consumer used a field (e.g.
        // `panelClass`) the first one didn't; keep this permissive rather
        // than enumerating every `MatSnackBarConfig` field callers might use.
        open(
            message: string,
            action?: string,
            config?: Record<string, unknown>
        ): MatSnackBarRef;
    }
}
