import { Injectable, inject } from '@angular/core';
import { DataService, PlaylistsService } from '@iptvnator/services';
import {
    addStalkerSource,
    asStalkerPortalError,
    StalkerPortalDiscoveryService,
    type StalkerPortalErrorKind,
} from '@iptvnator/portal/stalker/data-access';
import {
    createRandomId,
    normalizeStalkerMacAddress,
    normalizeXtreamServerUrl,
    PLAYLIST_PARSE_BY_URL,
    type Playlist,
} from '@iptvnator/shared/interfaces';
import type { TvAddSourceType } from '@iptvnator/tv/util';
import { firstValueFrom } from 'rxjs';

export type TvAddSourceOutcome =
    | { kind: 'added'; playlist: Playlist }
    | { kind: 'rejected'; message: string };

const STALKER_ERROR_MESSAGE_BY_KIND: Readonly<
    Record<StalkerPortalErrorKind, string>
> = {
    'login-required': 'This portal requires a username and password.',
    'login-rejected': 'The username or password was rejected.',
    'device-conflict':
        'This MAC address is already registered to another device.',
    blocked: 'The portal refused this account.',
    'auth-failed': 'Could not authenticate with the portal.',
};

function bookkeepingFields(): Pick<
    Playlist,
    'importDate' | 'lastUsage' | 'count' | 'autoRefresh'
> {
    const now = new Date().toISOString();
    return { importDate: now, lastUsage: now, count: 0, autoRefresh: false };
}

/**
 * Builds and persists a `Playlist` for any of tv mode's three source types —
 * the one place `TvAddSourceScreenComponent` calls, so its controller never
 * has to know Xtream URL normalization, Stalker portal discovery, or the
 * M3U-by-URL IPC bridge exist. Never throws: every failure comes back as a
 * `{kind: 'rejected', message}` the screen can show inline (tv mode has no
 * `MatSnackBar`/toast surface).
 */
@Injectable({ providedIn: 'root' })
export class TvAddSourceService {
    private readonly playlistsService = inject(PlaylistsService);
    private readonly dataService = inject(DataService);
    private readonly stalkerDiscovery = inject(StalkerPortalDiscoveryService);

    async addSource(
        type: TvAddSourceType,
        values: Readonly<Record<string, string>>
    ): Promise<TvAddSourceOutcome> {
        switch (type) {
            case 'xtream':
                return this.addXtream(values);
            case 'stalker':
                return this.addStalker(values);
            case 'm3u':
                return this.addM3u(values);
        }
    }

    private async addXtream(
        values: Readonly<Record<string, string>>
    ): Promise<TvAddSourceOutcome> {
        let serverUrl: string;
        try {
            serverUrl = normalizeXtreamServerUrl(values['serverUrl'] ?? '');
        } catch (error) {
            return {
                kind: 'rejected',
                message:
                    error instanceof Error
                        ? error.message
                        : 'Invalid server URL.',
            };
        }

        const playlist: Playlist = {
            _id: createRandomId(),
            title: values['title']?.trim() || serverUrl,
            serverUrl,
            username: values['username'] ?? '',
            password: values['password'] ?? '',
            ...bookkeepingFields(),
        };

        await firstValueFrom(this.playlistsService.addPlaylist(playlist));
        return { kind: 'added', playlist };
    }

    private async addStalker(
        values: Readonly<Record<string, string>>
    ): Promise<TvAddSourceOutcome> {
        const macAddress = normalizeStalkerMacAddress(
            values['macAddress'] ?? ''
        );
        if (!macAddress) {
            return {
                kind: 'rejected',
                message: 'Enter a valid MAC address.',
            };
        }
        const portalUrl = values['portalUrl']?.trim();
        if (!portalUrl) {
            return { kind: 'rejected', message: 'Enter a portal URL.' };
        }

        const result = await addStalkerSource(this.stalkerDiscovery, {
            title: values['title']?.trim() || portalUrl,
            macAddress,
            portalUrl,
            deriveDeviceIds: true,
        });

        if (result.status === 'auth-rejected') {
            if (result.abandonedInFlight) {
                // A late get_profile from the abandoned attempt can still
                // land on the wire and adopt this MAC's token — letting the
                // user resubmit before it settles risks a retry's session
                // being silently invalidated out from under it. Same guard
                // desktop's StalkerPortalImportComponent applies.
                await (result.abandonedAuthenticationSettled ??
                    Promise.resolve());
            }
            const portalError = asStalkerPortalError(result.error);
            return {
                kind: 'rejected',
                message: portalError
                    ? STALKER_ERROR_MESSAGE_BY_KIND[portalError.kind]
                    : STALKER_ERROR_MESSAGE_BY_KIND['auth-failed'],
            };
        }
        if (result.status === 'unreachable-refused') {
            return {
                kind: 'rejected',
                message: 'Could not reach the portal. Check the URL and MAC address.',
            };
        }

        const playlist: Playlist = {
            ...result.playlist,
            ...bookkeepingFields(),
        };
        await firstValueFrom(this.playlistsService.addPlaylist(playlist));
        return { kind: 'added', playlist };
    }

    private async addM3u(
        values: Readonly<Record<string, string>>
    ): Promise<TvAddSourceOutcome> {
        const url = values['url']?.trim();
        if (!url) {
            return { kind: 'rejected', message: 'Enter a playlist URL.' };
        }

        let fetched: Playlist;
        try {
            fetched = await this.dataService.sendIpcEvent<Playlist>(
                PLAYLIST_PARSE_BY_URL,
                { url, title: values['title']?.trim() || undefined }
            );
        } catch {
            return {
                kind: 'rejected',
                message: 'Could not load the playlist from that URL.',
            };
        }

        await firstValueFrom(this.playlistsService.addPlaylist(fetched));
        return { kind: 'added', playlist: fetched };
    }
}
