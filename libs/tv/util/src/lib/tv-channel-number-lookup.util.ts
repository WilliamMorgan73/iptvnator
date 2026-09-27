import { getChannelItemByNumber } from '@iptvnator/portal/shared/util';
import type { TvLiveChannel } from './tv-live-catalog.model';

/**
 * Resolves a typed digit string (from `TvDigitEntryController`) to a channel
 * within the active source, cross-category — the whole channel list the
 * source's adapter currently exposes, not just the selected category.
 *
 * `TvLiveChannel.channelNumber` is real and provider-assigned for Xtream
 * (`item.num`) and Stalker (`channel.number`), but M3U never sets it. Matching
 * by list POSITION for Xtream/Stalker would silently land on the wrong
 * channel whenever a provider's numbering has gaps, which is routine — so the
 * real field is matched first whenever any channel in the list carries one,
 * and position-based `getChannelItemByNumber()` (already used elsewhere for
 * hardware-remote channel navigation) is only the M3U fallback.
 */
export function resolveChannelByNumber(
    channels: readonly TvLiveChannel[],
    digits: string
): TvLiveChannel | null {
    const requestedNumber = Number(digits);
    if (!Number.isFinite(requestedNumber)) {
        return null;
    }

    const hasRealChannelNumbers = channels.some(
        (channel) => channel.channelNumber !== undefined
    );
    if (hasRealChannelNumbers) {
        return (
            channels.find(
                (channel) => channel.channelNumber === requestedNumber
            ) ?? null
        );
    }

    return getChannelItemByNumber([...channels], requestedNumber);
}
