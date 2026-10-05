import {
    asStalkerPortalError,
    type StalkerPortalErrorKind,
} from '@iptvnator/portal/stalker/data-access';

/** Headline shown for each way a portal can refuse the import. */
export const STALKER_IMPORT_ERROR_KEY_BY_KIND: Readonly<
    Record<StalkerPortalErrorKind, string>
> = {
    'login-required': 'HOME.STALKER_PORTAL.LOGIN_REQUIRED',
    'login-rejected': 'HOME.STALKER_PORTAL.LOGIN_REJECTED',
    'device-conflict': 'HOME.STALKER_PORTAL.DEVICE_CONFLICT',
    blocked: 'HOME.STALKER_PORTAL.PORTAL_REFUSED',
    'auth-failed': 'HOME.STALKER_PORTAL.AUTH_FAILED',
};

/**
 * What the import form shows inline when a portal refuses it: a translation
 * key, plus the portal's own explanation when it gave one. The template
 * translates both, so the message follows a language switch.
 */
export interface StalkerImportFeedback {
    key: string;
    portalText?: string;
}

/**
 * Turns an authentication failure into feedback the user can act on. The
 * portal explains refusals itself (`msg`/`block_msg`, or one of the
 * documented plain-text bodies); its own words are relayed verbatim.
 */
export function toStalkerImportFeedback(error: unknown): StalkerImportFeedback {
    const portalError = asStalkerPortalError(error);
    if (!portalError) {
        return { key: 'HOME.STALKER_PORTAL.AUTH_FAILED' };
    }

    return {
        key: STALKER_IMPORT_ERROR_KEY_BY_KIND[portalError.kind],
        ...(portalError.portalText
            ? { portalText: portalError.portalText }
            : {}),
    };
}
