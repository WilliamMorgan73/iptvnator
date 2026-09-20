import { signal } from '@angular/core';

export type GridFocusDirection = 'up' | 'down' | 'left' | 'right';

export interface GridFocusHost {
    itemCount(): number;
    /**
     * Items per row. `1` makes this a vertical list (up/down move, left/right
     * no-op); returning `itemCount()` makes it a single-row horizontal list
     * (left/right move, up/down no-op) — callers of a horizontal list remap
     * their own left/right key into `move('up'|'down')` rather than this
     * controller growing a second mode.
     */
    columnCount(): number;
}

/**
 * Roving focus over a 0-based index, grid-capable so a future grid browsing
 * mode (see the tv-mode plan's "Deferred" section) can reuse it unchanged.
 * `move()` only ever changes `focusedIndex` — it never activates or
 * navigates. Boundaries are a no-op, not a clamp: pressing further at an
 * edge leaves the focus exactly where it was.
 */
export class GridFocusController {
    readonly focusedIndex = signal<number | null>(null);

    constructor(private readonly host: GridFocusHost) {}

    move(direction: GridFocusDirection): void {
        const count = this.host.itemCount();
        if (count === 0) {
            this.focusedIndex.set(null);
            return;
        }
        const current = this.focusedIndex();
        if (current === null) {
            this.focusedIndex.set(0);
            return;
        }
        const columns = Math.max(1, this.host.columnCount());
        const next = this.nextIndex(current, direction, count, columns);
        if (next !== null) {
            this.focusedIndex.set(next);
        }
    }

    /** Enter / gamepad-A. Invokes `onActivate` with the focused index, if any. */
    activate(onActivate: (index: number) => void): void {
        const index = this.focusedIndex();
        if (index !== null) {
            onActivate(index);
        }
    }

    /** Escape / gamepad-B. Invokes `onBack` unconditionally. */
    back(onBack: () => void): void {
        onBack();
    }

    private nextIndex(
        current: number,
        direction: GridFocusDirection,
        count: number,
        columns: number
    ): number | null {
        switch (direction) {
            case 'up': {
                const target = current - columns;
                return target >= 0 ? target : null;
            }
            case 'down': {
                const target = current + columns;
                return target < count ? target : null;
            }
            case 'left': {
                const atRowStart = current % columns === 0;
                return atRowStart ? null : current - 1;
            }
            case 'right': {
                const atRowEnd = current % columns === columns - 1;
                const target = current + 1;
                return !atRowEnd && target < count ? target : null;
            }
        }
    }
}
