import { resolveTvAddSourceFields } from './tv-add-source-form.util';

describe('resolveTvAddSourceFields', () => {
    it('returns title, serverUrl, username, password(masked) for xtream', () => {
        expect(resolveTvAddSourceFields('xtream')).toEqual([
            { id: 'title', label: 'Title', masked: false },
            { id: 'serverUrl', label: 'Server URL', masked: false },
            { id: 'username', label: 'Username', masked: false },
            { id: 'password', label: 'Password', masked: true },
        ]);
    });

    it('returns title, portalUrl, macAddress for stalker', () => {
        expect(resolveTvAddSourceFields('stalker')).toEqual([
            { id: 'title', label: 'Title', masked: false },
            { id: 'portalUrl', label: 'Portal URL', masked: false },
            { id: 'macAddress', label: 'MAC address', masked: false },
        ]);
    });

    it('returns title, url for m3u', () => {
        expect(resolveTvAddSourceFields('m3u')).toEqual([
            { id: 'title', label: 'Title', masked: false },
            { id: 'url', label: 'Playlist URL', masked: false },
        ]);
    });
});
