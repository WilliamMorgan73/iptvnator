import {
    EPG_OFFSET_MAX_MINUTES,
    EPG_OFFSET_MIN_MINUTES,
    Language,
    Theme,
    type Settings,
} from '@iptvnator/shared/interfaces';

/** The one screen's curated, D-pad-navigable subset of `Settings` — see the
 * tv-mode plan's Milestone 7 scope note for why the other ~35 fields (player
 * paths, MPV/VLC argument textareas, folder pickers, TMDB API key entry,
 * backup/restore, window mode, etc.) are excluded: all are mouse/keyboard/
 * filesystem-shaped, restart-required, or meaningless without a VOD/
 * dashboard surface `apps/tv` doesn't have in v1. */
export type TvSettingsItemId =
    | 'language'
    | 'theme'
    | 'showCaptions'
    | 'stripCountryPrefix'
    | 'epgOffsetMinutes'
    | 'tvIdleTimeoutSeconds';

export type TvSettingsItemKind = 'select' | 'toggle' | 'number';

export interface TvSettingsItem {
    readonly id: TvSettingsItemId;
    readonly label: string;
    readonly kind: TvSettingsItemKind;
    readonly valueLabel: string;
}

export const DEFAULT_TV_IDLE_TIMEOUT_SECONDS = 5;
const TV_IDLE_TIMEOUT_MIN_SECONDS = 3;
const TV_IDLE_TIMEOUT_MAX_SECONDS = 60;
const TV_IDLE_TIMEOUT_STEP_SECONDS = 5;
const EPG_OFFSET_STEP_MINUTES = 30;

const LANGUAGE_ORDER: readonly Language[] = Object.values(Language);
const LANGUAGE_LABELS: Readonly<Record<Language, string>> = {
    [Language.ARABIC]: 'Arabic',
    [Language.MOROCCAN_ARABIC]: 'Moroccan Arabic',
    [Language.ENGLISH]: 'English',
    [Language.KOREAN]: 'Korean',
    [Language.RUSSIAN]: 'Russian',
    [Language.GERMAN]: 'German',
    [Language.SPANISH]: 'Spanish',
    [Language.CHINESE]: 'Chinese',
    [Language.TRADITIONAL_CHINESE]: 'Traditional Chinese',
    [Language.FRENCH]: 'French',
    [Language.ITALIAN]: 'Italian',
    [Language.TURKISH]: 'Turkish',
    [Language.JAPANESE]: 'Japanese',
    [Language.DUTCH]: 'Dutch',
    [Language.BELARUSIAN]: 'Belarusian',
    [Language.POLISH]: 'Polish',
    [Language.PORTUGUESE]: 'Portuguese',
    [Language.GREEK]: 'Greek',
    [Language.HUNGARIAN]: 'Hungarian',
};

const THEME_ORDER: readonly Theme[] = [
    Theme.SystemTheme,
    Theme.LightTheme,
    Theme.DarkTheme,
];
const THEME_LABELS: Readonly<Record<Theme, string>> = {
    [Theme.SystemTheme]: 'System',
    [Theme.LightTheme]: 'Light',
    [Theme.DarkTheme]: 'Dark',
};

function cycle<T>(values: readonly T[], current: T, direction: 'left' | 'right'): T {
    const index = values.indexOf(current);
    const base = index === -1 ? 0 : index;
    const delta = direction === 'right' ? 1 : -1;
    return values[(base + delta + values.length) % values.length];
}

function stepClamped(
    current: number,
    direction: 'left' | 'right',
    amount: number,
    min: number,
    max: number
): number {
    const next = current + (direction === 'right' ? amount : -amount);
    return Math.min(max, Math.max(min, next));
}

function formatOffsetMinutes(minutes: number): string {
    return minutes === 0 ? 'No offset' : `${minutes > 0 ? '+' : ''}${minutes} min`;
}

/** Builds the settings panel's row list from a `Settings` snapshot — pure,
 * so the panel component never needs to know the shape of `Settings`. */
export function resolveTvSettingsItems(settings: Settings): readonly TvSettingsItem[] {
    const idleTimeoutSeconds =
        settings.tvIdleTimeoutSeconds ?? DEFAULT_TV_IDLE_TIMEOUT_SECONDS;
    return [
        {
            id: 'language',
            label: 'Language',
            kind: 'select',
            valueLabel: LANGUAGE_LABELS[settings.language] ?? settings.language,
        },
        {
            id: 'theme',
            label: 'Theme',
            kind: 'select',
            valueLabel: THEME_LABELS[settings.theme] ?? settings.theme,
        },
        {
            id: 'showCaptions',
            label: 'Show captions',
            kind: 'toggle',
            valueLabel: settings.showCaptions ? 'On' : 'Off',
        },
        {
            id: 'stripCountryPrefix',
            label: 'Strip country prefix from channel names',
            kind: 'toggle',
            valueLabel: settings.stripCountryPrefix ? 'On' : 'Off',
        },
        {
            id: 'epgOffsetMinutes',
            label: 'EPG time offset',
            kind: 'number',
            valueLabel: formatOffsetMinutes(settings.epgOffsetMinutes ?? 0),
        },
        {
            id: 'tvIdleTimeoutSeconds',
            label: 'Idle timeout before fullscreen',
            kind: 'number',
            valueLabel: `${idleTimeoutSeconds}s`,
        },
    ];
}

/** Pure value-adjustment logic for one Left/Right press on a focused row —
 * returns the patch to hand `SettingsStore.updateSettings()` directly.
 * Enums wrap at their ends (a 19-language list dead-ending is worse than
 * wrapping); numbers clamp instead (jumping from +720 to -720 on one more
 * press, or letting the idle timeout reach 0/negative and break the
 * immersive-mode timer, would be worse than a no-op at the edge). */
export function adjustTvSettingsValue(
    settings: Settings,
    itemId: TvSettingsItemId,
    direction: 'left' | 'right'
): Partial<Settings> {
    switch (itemId) {
        case 'language':
            return { language: cycle(LANGUAGE_ORDER, settings.language, direction) };
        case 'theme':
            return { theme: cycle(THEME_ORDER, settings.theme, direction) };
        case 'showCaptions':
            return { showCaptions: !settings.showCaptions };
        case 'stripCountryPrefix':
            return { stripCountryPrefix: !settings.stripCountryPrefix };
        case 'epgOffsetMinutes':
            return {
                epgOffsetMinutes: stepClamped(
                    settings.epgOffsetMinutes ?? 0,
                    direction,
                    EPG_OFFSET_STEP_MINUTES,
                    EPG_OFFSET_MIN_MINUTES,
                    EPG_OFFSET_MAX_MINUTES
                ),
            };
        case 'tvIdleTimeoutSeconds':
            return {
                tvIdleTimeoutSeconds: stepClamped(
                    settings.tvIdleTimeoutSeconds ?? DEFAULT_TV_IDLE_TIMEOUT_SECONDS,
                    direction,
                    TV_IDLE_TIMEOUT_STEP_SECONDS,
                    TV_IDLE_TIMEOUT_MIN_SECONDS,
                    TV_IDLE_TIMEOUT_MAX_SECONDS
                ),
            };
    }
}
