import type { EpgItem } from './epg-item.interface';
import type { EpgProgram } from './epg-program.model';

/**
 * Maps the DB-shaped `EpgItem` (returned by short-EPG fetches such as
 * Stalker's `fetchChannelEpg`) into the leaner `EpgProgram` shape consumers
 * like `StalkerEpgPreviewQueue` and `getCurrentProgramsBatch` work with. The
 * channel id always comes from the caller, not `item.channel_id` — the
 * caller already knows which channel it fetched for, and the item's own
 * field is not guaranteed to agree.
 */
export function epgItemToProgram(
    item: EpgItem,
    channelId: string | number
): EpgProgram {
    return {
        start: item.start,
        stop: item.stop || item.end,
        channel: String(channelId),
        title: item.title,
        desc: item.description || null,
        category: null,
        startTimestamp: toNullableInteger(item.start_timestamp),
        stopTimestamp: toNullableInteger(item.stop_timestamp),
    };
}

function toNullableInteger(value: string | undefined): number | null {
    const parsed = Number.parseInt(value ?? '', 10);
    return Number.isFinite(parsed) ? parsed : null;
}
