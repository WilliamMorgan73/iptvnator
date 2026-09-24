export type TvAddSourceType = 'xtream' | 'stalker' | 'm3u';

export type TvAddSourceFieldId =
    | 'title'
    | 'serverUrl'
    | 'username'
    | 'password'
    | 'portalUrl'
    | 'macAddress'
    | 'url';

export interface TvAddSourceField {
    readonly id: TvAddSourceFieldId;
    readonly label: string;
    readonly masked: boolean;
}

const FIELDS_BY_TYPE: Readonly<Record<TvAddSourceType, readonly TvAddSourceField[]>> = {
    xtream: [
        { id: 'title', label: 'Title', masked: false },
        { id: 'serverUrl', label: 'Server URL', masked: false },
        { id: 'username', label: 'Username', masked: false },
        { id: 'password', label: 'Password', masked: true },
    ],
    stalker: [
        { id: 'title', label: 'Title', masked: false },
        { id: 'portalUrl', label: 'Portal URL', masked: false },
        { id: 'macAddress', label: 'MAC address', masked: false },
    ],
    m3u: [
        { id: 'title', label: 'Title', masked: false },
        { id: 'url', label: 'Playlist URL', masked: false },
    ],
};

/** The fields the Add Source screen shows for a given source type, in
 * display order. Pure lookup so the screen's controller and its tests never
 * need to know the field set for a type — see `TvAddSourceController`. */
export function resolveTvAddSourceFields(
    type: TvAddSourceType
): readonly TvAddSourceField[] {
    return FIELDS_BY_TYPE[type];
}
