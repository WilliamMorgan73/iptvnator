import { signal } from '@angular/core';
import {
    GridFocusController,
    resolveTvAddSourceFields,
    resolveTvKeyboardChar,
    TV_KEYBOARD_COLUMNS,
    TV_KEYBOARD_LAYOUT,
    type GridFocusDirection,
    type TvAddSourceField,
    type TvAddSourceFieldId,
    type TvAddSourceType,
} from '@iptvnator/tv/util';

export type TvAddSourceRegion = 'tabs' | 'fields';

const SOURCE_TYPES: readonly TvAddSourceType[] = ['xtream', 'stalker', 'm3u'];

export type TvAddSourceSubmitResult =
    | { status: 'ok' }
    | { status: 'error'; message: string };

export interface TvAddSourceConfig {
    onSubmit(
        type: TvAddSourceType,
        values: Readonly<Record<string, string>>
    ): Promise<TvAddSourceSubmitResult>;
    onCancel(): void;
}

/**
 * Owns everything about the Add Source screen — which type tab is active,
 * which field is focused/being edited, and the on-screen keyboard's own
 * focus — the same "one DI-free plain controller per screen, config
 * callbacks for side effects" pattern `TvLivePanesController` uses for the
 * live screen. `TvOnscreenKeyboardComponent` is a pure renderer (no
 * GridFocusController of its own, unlike a first read of the plan implied —
 * every existing tv-ui grid/list component is `input()`-driven with focus
 * owned by the shell, and this keeps that precedent instead of introducing
 * a second pattern): this controller owns the keyboard's `GridFocusController`
 * too and resolves activation directly against `TV_KEYBOARD_LAYOUT`.
 */
export class TvAddSourceController {
    readonly sourceType = signal<TvAddSourceType>('xtream');
    readonly region = signal<TvAddSourceRegion>('tabs');
    readonly editingFieldId = signal<TvAddSourceFieldId | null>(null);
    readonly editBuffer = signal('');
    readonly keyboardShiftActive = signal(false);
    readonly fieldValues = signal<Readonly<Record<string, string>>>({});
    readonly submitting = signal(false);
    readonly statusMessage = signal<string | null>(null);

    readonly tabsController = new GridFocusController({
        itemCount: () => SOURCE_TYPES.length,
        columnCount: () => SOURCE_TYPES.length,
    });

    // +1: a synthetic trailing "Add source" row, same trick the live
    // screen's sourcesController uses for its own trailing row.
    readonly fieldsController = new GridFocusController({
        itemCount: () => this.fieldsForType().length + 1,
        columnCount: () => 1,
    });

    readonly keyboardController = new GridFocusController({
        itemCount: () => TV_KEYBOARD_LAYOUT.length,
        columnCount: () => TV_KEYBOARD_COLUMNS,
    });

    constructor(private readonly config: TvAddSourceConfig) {
        this.tabsController.focusedIndex.set(0);
    }

    get isEditing(): boolean {
        return this.editingFieldId() !== null;
    }

    fieldsForType(): readonly TvAddSourceField[] {
        return resolveTvAddSourceFields(this.sourceType());
    }

    onDirection(direction: GridFocusDirection): void {
        if (this.isEditing) {
            this.keyboardController.move(direction);
            return;
        }
        if (this.region() === 'tabs') {
            if (direction === 'down') {
                this.region.set('fields');
                this.fieldsController.focusedIndex.set(0);
                return;
            }
            this.tabsController.move(direction);
            return;
        }
        if (direction === 'up' && this.fieldsController.focusedIndex() === 0) {
            this.region.set('tabs');
            return;
        }
        this.fieldsController.move(direction);
    }

    onActivate(): void {
        if (this.isEditing) {
            this.keyboardController.activate((index) =>
                this.activateKeyboardKey(index)
            );
            return;
        }
        if (this.region() === 'tabs') {
            this.tabsController.activate((index) => this.selectTab(index));
            return;
        }
        this.fieldsController.activate((index) => {
            const fields = this.fieldsForType();
            if (index === fields.length) {
                void this.submit();
                return;
            }
            this.beginEditField(fields[index].id);
        });
    }

    onBack(): void {
        if (this.isEditing) {
            this.cancelEditField();
            return;
        }
        if (this.region() === 'fields') {
            this.region.set('tabs');
            return;
        }
        this.config.onCancel();
    }

    beginEditField(fieldId: TvAddSourceFieldId): void {
        this.editingFieldId.set(fieldId);
        this.editBuffer.set(this.fieldValues()[fieldId] ?? '');
        this.keyboardShiftActive.set(false);
        this.keyboardController.focusedIndex.set(0);
    }

    commitEditField(): void {
        const fieldId = this.editingFieldId();
        if (fieldId === null) {
            return;
        }
        const value = this.editBuffer();
        this.fieldValues.update((values) => ({ ...values, [fieldId]: value }));
        this.editingFieldId.set(null);
    }

    cancelEditField(): void {
        this.editingFieldId.set(null);
    }

    private activateKeyboardKey(index: number): void {
        const key = TV_KEYBOARD_LAYOUT[index];
        const char = resolveTvKeyboardChar(key, this.keyboardShiftActive());
        if (char !== null) {
            this.editBuffer.update((value) => value + char);
            return;
        }
        if (key.kind === 'backspace') {
            this.editBuffer.update((value) => value.slice(0, -1));
            return;
        }
        if (key.kind === 'shift') {
            this.keyboardShiftActive.update((value) => !value);
            return;
        }
        if (key.kind === 'done') {
            this.commitEditField();
        }
    }

    private selectTab(index: number): void {
        const type = SOURCE_TYPES[index];
        if (type === this.sourceType()) {
            return;
        }
        this.sourceType.set(type);
        this.fieldValues.set({});
        this.statusMessage.set(null);
        this.fieldsController.focusedIndex.set(null);
    }

    private async submit(): Promise<void> {
        if (this.submitting()) {
            return;
        }
        this.submitting.set(true);
        this.statusMessage.set(null);
        try {
            const result = await this.config.onSubmit(
                this.sourceType(),
                this.fieldValues()
            );
            if (result.status === 'error') {
                this.statusMessage.set(result.message);
            }
        } finally {
            this.submitting.set(false);
        }
    }
}
