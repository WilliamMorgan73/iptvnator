import { signal } from '@angular/core';

export interface TvEpgGuideFocus {
    readonly row: number;
    /** Block index inside the row, or null when the whole row is focused
     * (e.g. right after moving vertically). */
    readonly block: number | null;
}

export interface TvEpgGuideFocusHost {
    rowCount(): number;
    /** Each channel row has its OWN number of programme blocks. */
    blockCount(row: number): number;
}

/**
 * 2D roving focus for the guide grid. Deliberately NOT `GridFocusController`:
 * that class assumes one fixed column count for every row (the channel
 * grid's uniform tiles), which doesn't fit a guide row's ragged, per-channel
 * block count. Vertical movement resets to whole-row focus (`block: null`) —
 * a fresh row's block layout has nothing to do with the previous row's
 * column position, same reasoning as desktop's `EpgGuideKeyboardController`.
 * Boundaries are a no-op, not a clamp — same convention as
 * `GridFocusController`.
 */
export class TvEpgGuideFocusController {
    readonly focus = signal<TvEpgGuideFocus | null>(null);

    constructor(private readonly host: TvEpgGuideFocusHost) {}

    moveRow(delta: 1 | -1): void {
        const count = this.host.rowCount();
        if (count === 0) {
            return;
        }
        const current = this.focus()?.row ?? (delta > 0 ? -1 : count);
        const next = current + delta;
        if (next < 0 || next >= count) {
            return;
        }
        this.focus.set({ row: next, block: null });
    }

    moveBlock(delta: 1 | -1): void {
        const current = this.focus();
        if (!current) {
            return;
        }
        const blocks = this.host.blockCount(current.row);
        if (blocks === 0) {
            return;
        }
        const start = current.block ?? (delta > 0 ? -1 : blocks);
        const next = start + delta;
        if (next < 0 || next >= blocks) {
            return;
        }
        this.focus.set({ row: current.row, block: next });
    }

    /** Enter/gamepad-A. Invokes `onActivate` with the focused ROW — block
     * position never matters for activation, only which channel. */
    activate(onActivate: (row: number) => void): void {
        const current = this.focus();
        if (current) {
            onActivate(current.row);
        }
    }

    reset(): void {
        this.focus.set(null);
    }
}
