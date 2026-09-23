import {
    Language,
    StreamFormat,
    Theme,
    VideoPlayer,
    type Settings,
} from '@iptvnator/shared/interfaces';
import { adjustTvSettingsValue, resolveTvSettingsItems } from './tv-settings-item.util';

function settings(overrides: Partial<Settings> = {}): Settings {
    return {
        player: VideoPlayer.VideoJs,
        epgUrl: [],
        streamFormat: StreamFormat.AutoStreamFormat,
        openStreamOnDoubleClick: false,
        language: Language.ENGLISH,
        showCaptions: false,
        showDashboard: true,
        startupBehavior: 'first-view' as Settings['startupBehavior'],
        theme: Theme.SystemTheme,
        mpvPlayerPath: '',
        mpvPlayerArguments: '',
        mpvReuseInstance: false,
        vlcPlayerPath: '',
        vlcPlayerArguments: '',
        vlcReuseInstance: false,
        remoteControl: false,
        remoteControlPort: 8765,
        stripCountryPrefix: false,
        epgOffsetMinutes: 0,
        tvIdleTimeoutSeconds: 5,
        ...overrides,
    };
}

describe('resolveTvSettingsItems', () => {
    it('builds all six rows with their current value labels', () => {
        const items = resolveTvSettingsItems(
            settings({
                language: Language.GERMAN,
                theme: Theme.DarkTheme,
                showCaptions: true,
                stripCountryPrefix: true,
                epgOffsetMinutes: 90,
                tvIdleTimeoutSeconds: 10,
            })
        );

        expect(items.map((item) => item.id)).toEqual([
            'language',
            'theme',
            'showCaptions',
            'stripCountryPrefix',
            'epgOffsetMinutes',
            'tvIdleTimeoutSeconds',
        ]);
        expect(items.map((item) => item.valueLabel)).toEqual([
            'German',
            'Dark',
            'On',
            'On',
            '+90 min',
            '10s',
        ]);
    });

    it('falls back to defaults for unset optional fields', () => {
        const items = resolveTvSettingsItems(
            settings({ epgOffsetMinutes: undefined, tvIdleTimeoutSeconds: undefined })
        );

        const byId = Object.fromEntries(items.map((item) => [item.id, item.valueLabel]));
        expect(byId['epgOffsetMinutes']).toBe('No offset');
        expect(byId['tvIdleTimeoutSeconds']).toBe('5s');
    });

    it('formats a negative EPG offset with a leading minus, not a double sign', () => {
        const items = resolveTvSettingsItems(settings({ epgOffsetMinutes: -60 }));
        expect(items.find((item) => item.id === 'epgOffsetMinutes')?.valueLabel).toBe(
            '-60 min'
        );
    });
});

describe('adjustTvSettingsValue', () => {
    it('cycles the language forward and wraps past the last entry', () => {
        const last = settings({ language: Language.HUNGARIAN });
        expect(adjustTvSettingsValue(last, 'language', 'right')).toEqual({
            language: Language.ARABIC,
        });
    });

    it('cycles the language backward and wraps past the first entry', () => {
        const first = settings({ language: Language.ARABIC });
        expect(adjustTvSettingsValue(first, 'language', 'left')).toEqual({
            language: Language.HUNGARIAN,
        });
    });

    it('cycles theme forward through its fixed 3-value order', () => {
        expect(
            adjustTvSettingsValue(settings({ theme: Theme.SystemTheme }), 'theme', 'right')
        ).toEqual({ theme: Theme.LightTheme });
        expect(
            adjustTvSettingsValue(settings({ theme: Theme.LightTheme }), 'theme', 'right')
        ).toEqual({ theme: Theme.DarkTheme });
        expect(
            adjustTvSettingsValue(settings({ theme: Theme.DarkTheme }), 'theme', 'right')
        ).toEqual({ theme: Theme.SystemTheme });
    });

    it('flips showCaptions and stripCountryPrefix regardless of direction', () => {
        expect(
            adjustTvSettingsValue(settings({ showCaptions: false }), 'showCaptions', 'right')
        ).toEqual({ showCaptions: true });
        expect(
            adjustTvSettingsValue(settings({ showCaptions: true }), 'showCaptions', 'left')
        ).toEqual({ showCaptions: false });
        expect(
            adjustTvSettingsValue(
                settings({ stripCountryPrefix: false }),
                'stripCountryPrefix',
                'right'
            )
        ).toEqual({ stripCountryPrefix: true });
    });

    it('steps the EPG offset by 30 minutes and clamps at ±720', () => {
        expect(
            adjustTvSettingsValue(settings({ epgOffsetMinutes: 0 }), 'epgOffsetMinutes', 'right')
        ).toEqual({ epgOffsetMinutes: 30 });
        expect(
            adjustTvSettingsValue(settings({ epgOffsetMinutes: 0 }), 'epgOffsetMinutes', 'left')
        ).toEqual({ epgOffsetMinutes: -30 });
        expect(
            adjustTvSettingsValue(
                settings({ epgOffsetMinutes: 720 }),
                'epgOffsetMinutes',
                'right'
            )
        ).toEqual({ epgOffsetMinutes: 720 });
        expect(
            adjustTvSettingsValue(
                settings({ epgOffsetMinutes: -720 }),
                'epgOffsetMinutes',
                'left'
            )
        ).toEqual({ epgOffsetMinutes: -720 });
    });

    it('steps the idle timeout by 5s and clamps between 3s and 60s', () => {
        expect(
            adjustTvSettingsValue(
                settings({ tvIdleTimeoutSeconds: 5 }),
                'tvIdleTimeoutSeconds',
                'right'
            )
        ).toEqual({ tvIdleTimeoutSeconds: 10 });
        expect(
            adjustTvSettingsValue(
                settings({ tvIdleTimeoutSeconds: 5 }),
                'tvIdleTimeoutSeconds',
                'left'
            )
        ).toEqual({ tvIdleTimeoutSeconds: 3 });
        expect(
            adjustTvSettingsValue(
                settings({ tvIdleTimeoutSeconds: 60 }),
                'tvIdleTimeoutSeconds',
                'right'
            )
        ).toEqual({ tvIdleTimeoutSeconds: 60 });
        expect(
            adjustTvSettingsValue(
                settings({ tvIdleTimeoutSeconds: undefined }),
                'tvIdleTimeoutSeconds',
                'left'
            )
        ).toEqual({ tvIdleTimeoutSeconds: 3 });
    });
});
