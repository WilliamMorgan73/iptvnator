import { Directive, HostListener, output } from '@angular/core';
import type { GridFocusDirection } from '@iptvnator/tv/util';

const DIRECTION_KEYS: Readonly<Record<string, GridFocusDirection>> = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
};

const INTERACTIVE_SELECTOR =
    'input, textarea, select, button, [role="button"], a[href], [contenteditable=""], [contenteditable="true"]';

function isForeignInteractiveTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
        return false;
    }
    return target.isContentEditable || target.closest(INTERACTIVE_SELECTOR) !== null;
}

/**
 * Keyboard stand-in for a gamepad D-pad/A/B, same gating pattern as
 * `EpgGuideKeyboardController` (ignore when a dialog/interactive element owns
 * focus). The tv-mode shell has no real DOM focus target — the listener sits
 * on `document` because nothing else claims these keys in tv mode.
 */
@Directive({
    selector: '[appTvKeyboardInput]',
})
export class TvKeyboardInputDirective {
    readonly direction = output<GridFocusDirection>();
    readonly activate = output<void>();
    readonly back = output<void>();

    @HostListener('document:keydown', ['$event'])
    onKeydown(event: KeyboardEvent): void {
        if (
            event.defaultPrevented ||
            event.metaKey ||
            event.ctrlKey ||
            event.altKey ||
            isForeignInteractiveTarget(event.target)
        ) {
            return;
        }
        const direction = DIRECTION_KEYS[event.key];
        if (direction) {
            event.preventDefault();
            this.direction.emit(direction);
            return;
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            this.activate.emit();
            return;
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            this.back.emit();
        }
    }
}
