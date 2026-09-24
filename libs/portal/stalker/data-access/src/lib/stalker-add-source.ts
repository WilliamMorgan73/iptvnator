import {
    createRandomId,
    deriveStalkerDeviceIdsFromMac,
    isFullStalkerPortalUrl,
    normalizeStalkerPortalIdentity,
    type Playlist,
    type StalkerPortalIdentity,
} from '@iptvnator/shared/interfaces';
import {
    legacyTransformStalkerPortalUrl,
    normalizeStalkerPortalInputUrl,
} from './stalker-portal-discovery.utils';
import { STALKER_WATCHDOG_DEFAULT_PERIOD_SECONDS } from './stalker-watchdog.controller';
import { stalkerSessionFingerprint } from './stalker-session-store';
import {
    StalkerPortalDiscoveryService,
    type StalkerPortalDiscoveryRejection,
} from './stalker-portal-discovery.service';

/** The `stalker*` playlist columns a resolved identity maps onto, omitting
 * every empty field — absence is meaningful (see `toStalkerPlaylistIdentityFields`
 * below), never send an empty `device_id`. */
interface StalkerPlaylistIdentityFields {
    stalkerSerialNumber?: string;
    stalkerDeviceId1?: string;
    stalkerDeviceId2?: string;
    stalkerSignature1?: string;
    stalkerSignature2?: string;
}

function toStalkerPlaylistIdentityFields(
    identity: StalkerPortalIdentity
): StalkerPlaylistIdentityFields {
    return {
        ...(identity.serialNumber
            ? { stalkerSerialNumber: identity.serialNumber }
            : {}),
        ...(identity.deviceId1
            ? { stalkerDeviceId1: identity.deviceId1 }
            : {}),
        ...(identity.deviceId2
            ? { stalkerDeviceId2: identity.deviceId2 }
            : {}),
        ...(identity.signature1
            ? { stalkerSignature1: identity.signature1 }
            : {}),
        ...(identity.signature2
            ? { stalkerSignature2: identity.signature2 }
            : {}),
    };
}

export interface StalkerAddSourceInput {
    id?: string;
    title: string;
    macAddress: string;
    portalUrl: string;
    username?: string;
    password?: string;
    userAgent?: string;
    serialNumber?: string;
    signature1?: string;
    signature2?: string;
    importDate?: string;
    /** When true, derives deviceId1/2 from `macAddress` via
     * `deriveStalkerDeviceIdsFromMac` before probing. When false/omitted,
     * `deviceId1`/`deviceId2` are used verbatim (desktop's manual path). */
    deriveDeviceIds?: boolean;
    deviceId1?: string;
    deviceId2?: string;
}

export type StalkerAddSourceResult =
    | { status: 'ok'; playlist: Playlist }
    | StalkerPortalDiscoveryRejection
    | { status: 'unreachable-refused' }
    | { status: 'unreachable-added'; playlist: Playlist };

/**
 * Probes a Stalker portal and builds the `Playlist` to persist — the exact
 * orchestration `StalkerPortalImportComponent.addPlaylist()` used to inline
 * (identity build → `discover()` → per-status branching → final playlist
 * shape), extracted so desktop and `apps/tv` share one implementation of
 * auth-state-mutating logic that must never drift between the two UIs.
 * Never persists — the caller owns `PlaylistsService.addPlaylist()`.
 */
export async function addStalkerSource(
    portalDiscovery: Pick<StalkerPortalDiscoveryService, 'discover'>,
    input: StalkerAddSourceInput
): Promise<StalkerAddSourceResult> {
    const originalUrl = input.portalUrl;
    let deviceId1 = input.deviceId1 ?? '';
    let deviceId2 = input.deviceId2 ?? '';
    if (input.deriveDeviceIds) {
        const derived = await deriveStalkerDeviceIdsFromMac(
            input.macAddress
        );
        deviceId1 = derived?.deviceId1 ?? '';
        deviceId2 = derived?.deviceId2 ?? '';
    }

    const stalkerIdentity = normalizeStalkerPortalIdentity({
        serialNumber: input.serialNumber || undefined,
        deviceId1: deviceId1 || undefined,
        deviceId2: deviceId2 || undefined,
        signature1: input.signature1 || undefined,
        signature2: input.signature2 || undefined,
    });

    const discovery = await portalDiscovery.discover(
        originalUrl,
        input.macAddress,
        stalkerIdentity,
        {
            credentials: {
                username: input.username ?? '',
                password: input.password ?? '',
            },
        }
    );

    let portalUrl: string;
    let isFullStalkerPortal: boolean;
    let stalkerToken: string | undefined;
    let stalkerAccountInfo: Playlist['stalkerAccountInfo'] | undefined;
    // The import profile is the only get_profile some portals ever see:
    // later starts reuse the token and skip it, so the cadence it advertises
    // has to be persisted here or the watchdog would stay on the 120s
    // default forever. Effective values, so stored absence keeps meaning
    // "never profiled".
    let stalkerWatchdogTimeout: number | undefined;
    let stalkerTimeslot: number | undefined;
    let addedWithoutValidation = false;

    if (discovery.status === 'resolved') {
        portalUrl = discovery.portalUrl;
        isFullStalkerPortal = discovery.isFullStalkerPortal;
        stalkerToken = discovery.token;
        if (stalkerToken) {
            stalkerWatchdogTimeout =
                discovery.watchdogTimeoutSeconds ??
                STALKER_WATCHDOG_DEFAULT_PERIOD_SECONDS;
            stalkerTimeslot = discovery.timeslotSeconds ?? 0;
        }
        if (discovery.accountInfo) {
            stalkerAccountInfo = {
                login: discovery.accountInfo.login,
                expireDate: discovery.accountInfo.expire_date,
                tariffPlanName: discovery.accountInfo.tariff_plan_name,
                status: discovery.accountInfo.status,
            };
        }
    } else if (discovery.status === 'auth-rejected') {
        return discovery;
    } else if (
        isFullStalkerPortalUrl(
            normalizeStalkerPortalInputUrl(originalUrl) ?? originalUrl
        )
    ) {
        // Unreachable host on a canonical-portal URL shape: the mandatory
        // handshake could not succeed either way.
        return { status: 'unreachable-refused' };
    } else {
        // Unreachable host on a panel-style URL: import with the legacy
        // guess so a temporarily offline panel can still be added. The lazy
        // portal repair re-probes on the first real failure. Normalized
        // first: the legacy suffix rewrites run on the path, so a
        // query/fragment must not hide a trailing `/c`.
        portalUrl = legacyTransformStalkerPortalUrl(
            normalizeStalkerPortalInputUrl(originalUrl) ?? originalUrl
        );
        isFullStalkerPortal = false;
        addedWithoutValidation = true;
    }

    const playlist: Playlist = {
        _id: input.id ?? createRandomId(),
        title: input.title,
        importDate: input.importDate ?? new Date().toISOString(),
        userAgent: input.userAgent,
        username: input.username,
        password: input.password,
        macAddress: input.macAddress,
        portalUrl,
        isFullStalkerPortal,
        stalkerToken,
        // What this token was negotiated for: endpoint, identity AND
        // credentials. Reuse is refused when any of them no longer matches —
        // and the credentials must be included here, or the first runtime
        // `ensureToken()` would compute a fingerprint WITH them, mismatch
        // this one, and throw away the session just established.
        ...(stalkerToken
            ? {
                  stalkerSessionIdentity: stalkerSessionFingerprint({
                      portalUrl,
                      macAddress: input.macAddress,
                      username: input.username ?? '',
                      password: input.password ?? '',
                      ...toStalkerPlaylistIdentityFields(stalkerIdentity),
                  } as Playlist),
              }
            : {}),
        stalkerWatchdogTimeout,
        stalkerTimeslot,
        stalkerAccountInfo,
        ...toStalkerPlaylistIdentityFields(stalkerIdentity),
    } as Playlist;

    return addedWithoutValidation
        ? { status: 'unreachable-added', playlist }
        : { status: 'ok', playlist };
}
