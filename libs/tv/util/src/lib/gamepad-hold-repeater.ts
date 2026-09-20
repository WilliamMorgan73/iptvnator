const INITIAL_REPEAT_DELAY_MS = 400;
const REPEAT_INTERVAL_MS = 150;

/**
 * OS-style key-repeat for a held input, driven by whatever clock the caller
 * supplies (so it's testable without real timers, `requestAnimationFrame`,
 * or a real gamepad). Fires once on the frame a key first appears held, then
 * again after `INITIAL_REPEAT_DELAY_MS`, then every `REPEAT_INTERVAL_MS`.
 */
export class GamepadHoldRepeater<TKey> {
    private readonly held = new Map<
        TKey,
        { pressedAtMs: number; lastFireMs: number }
    >();

    /** Call once per poll frame with the keys currently held. Returns the keys to fire this frame. */
    update(heldKeys: ReadonlySet<TKey>, nowMs: number): TKey[] {
        for (const key of this.held.keys()) {
            if (!heldKeys.has(key)) {
                this.held.delete(key);
            }
        }
        const fired: TKey[] = [];
        for (const key of heldKeys) {
            const existing = this.held.get(key);
            if (!existing) {
                this.held.set(key, { pressedAtMs: nowMs, lastFireMs: nowMs });
                fired.push(key);
                continue;
            }
            const heldForMs = nowMs - existing.pressedAtMs;
            const sinceLastFireMs = nowMs - existing.lastFireMs;
            if (
                heldForMs >= INITIAL_REPEAT_DELAY_MS &&
                sinceLastFireMs >= REPEAT_INTERVAL_MS
            ) {
                existing.lastFireMs = nowMs;
                fired.push(key);
            }
        }
        return fired;
    }
}

/** Edge-triggered, no repeat: fires once per press, again only after a release. */
export class GamepadEdgeTracker<TKey> {
    private held = new Set<TKey>();

    update(heldKeys: ReadonlySet<TKey>): TKey[] {
        const fired = [...heldKeys].filter((key) => !this.held.has(key));
        this.held = new Set(heldKeys);
        return fired;
    }
}
