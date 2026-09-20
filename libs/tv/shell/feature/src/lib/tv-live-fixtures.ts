import type { TvLiveCategory, TvLiveChannel } from '@iptvnator/tv/util';

/**
 * Hardcoded stand-in for the Milestone 3 source adapters (Xtream/Stalker/M3U)
 * so Milestone 1 can prove the focus engine and layout end to end before any
 * real portal is wired in. Numbers/titles match the design mockup.
 */
export const TV_LIVE_FIXTURE_CATEGORIES: readonly TvLiveCategory[] = [
    { id: 'all', name: 'All' },
    { id: 'sports', name: 'Sports' },
    { id: 'news', name: 'News' },
    { id: 'movies', name: 'Movies' },
];

const SPORTS_CHANNELS: readonly TvLiveChannel[] = [
    {
        id: 'sports-1',
        name: 'Nova Sports 1',
        categoryId: 'sports',
        sourceKind: 'xtream',
        channelNumber: 101,
        playRef: null,
        currentProgramTitle: 'Derby Final — 2nd half',
        currentProgramProgress: 0.64,
    },
    {
        id: 'sports-2',
        name: 'Nova Sports 2',
        categoryId: 'sports',
        sourceKind: 'xtream',
        channelNumber: 102,
        playRef: null,
        currentProgramTitle: 'Weekly Highlights',
    },
    {
        id: 'arena-extra',
        name: 'Arena Extra',
        categoryId: 'sports',
        sourceKind: 'xtream',
        channelNumber: 103,
        playRef: null,
        currentProgramTitle: 'Courtside Tonight',
    },
    {
        id: 'trackside',
        name: 'Trackside',
        categoryId: 'sports',
        sourceKind: 'xtream',
        channelNumber: 104,
        playRef: null,
        currentProgramTitle: 'Qualifying Laps',
    },
    {
        id: 'ringside-live',
        name: 'Ringside Live',
        categoryId: 'sports',
        sourceKind: 'xtream',
        channelNumber: 105,
        playRef: null,
        currentProgramTitle: 'Featherweight Bout',
    },
    {
        id: 'pitch-weekly',
        name: 'Pitch Weekly',
        categoryId: 'sports',
        sourceKind: 'xtream',
        channelNumber: 106,
        playRef: null,
        currentProgramTitle: 'Transfer Roundup',
    },
];

const NEWS_CHANNELS: readonly TvLiveChannel[] = [
    {
        id: 'world-news-1',
        name: 'World News 1',
        categoryId: 'news',
        sourceKind: 'stalker',
        channelNumber: 201,
        playRef: null,
        currentProgramTitle: 'Evening Bulletin',
    },
    {
        id: 'business-now',
        name: 'Business Now',
        categoryId: 'news',
        sourceKind: 'stalker',
        channelNumber: 202,
        playRef: null,
        currentProgramTitle: 'Markets Wrap',
    },
];

const MOVIES_CHANNELS: readonly TvLiveChannel[] = [
    {
        id: 'movie-classics',
        name: 'Movie Classics',
        categoryId: 'movies',
        sourceKind: 'm3u',
        channelNumber: 301,
        playRef: null,
        currentProgramTitle: 'Midnight Feature',
    },
    {
        id: 'action-max',
        name: 'Action Max',
        categoryId: 'movies',
        sourceKind: 'm3u',
        channelNumber: 302,
        playRef: null,
        currentProgramTitle: 'Prime Time Movie',
    },
];

export const TV_LIVE_FIXTURE_CHANNELS_BY_CATEGORY: Readonly<
    Record<string, readonly TvLiveChannel[]>
> = {
    all: [...SPORTS_CHANNELS, ...NEWS_CHANNELS, ...MOVIES_CHANNELS],
    sports: SPORTS_CHANNELS,
    news: NEWS_CHANNELS,
    movies: MOVIES_CHANNELS,
};
