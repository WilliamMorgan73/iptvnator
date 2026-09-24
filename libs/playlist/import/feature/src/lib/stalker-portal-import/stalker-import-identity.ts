import type { StalkerPortalErrorKind } from '@iptvnator/portal/stalker/data-access';

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
