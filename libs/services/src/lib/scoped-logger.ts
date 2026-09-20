import { redactSensitiveData } from '@iptvnator/shared/logging';

export interface ScopedLogger {
    debug: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
}

function isProductionBuild(): boolean {
    const globalWithNgDevMode = globalThis as typeof globalThis & {
        ngDevMode?: boolean;
    };
    return globalWithNgDevMode.ngDevMode === false;
}

/**
 * A prefixed, redacting console logger. `libs/portal/shared/util` has an
 * identical `createLogger` — that copy is `domain:portal-shared`-tagged and
 * off limits to this `domain:shared-runtime` lib under the Nx module-boundary
 * rules (`docs/architecture/nx-workspace-boundaries.md`), so this is a small,
 * intentional duplicate rather than a cross-domain import, kept in sync by
 * hand since both are tiny.
 */
export function createScopedLogger(scope: string): ScopedLogger {
    const prefix = `[${scope}]`;
    const debugEnabled = !isProductionBuild();

    return {
        debug: (...args: unknown[]) => {
            if (debugEnabled) {
                console.debug(
                    prefix,
                    ...args.map((arg) => redactSensitiveData(arg))
                );
            }
        },
        info: (...args: unknown[]) => {
            if (debugEnabled) {
                console.info(
                    prefix,
                    ...args.map((arg) => redactSensitiveData(arg))
                );
            }
        },
        warn: (...args: unknown[]) => {
            console.warn(
                prefix,
                ...args.map((arg) => redactSensitiveData(arg))
            );
        },
        error: (...args: unknown[]) => {
            console.error(
                prefix,
                ...args.map((arg) => redactSensitiveData(arg))
            );
        },
    };
}
