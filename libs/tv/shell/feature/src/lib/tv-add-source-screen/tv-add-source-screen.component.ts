import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
    TvAddSourceFieldRowComponent,
    TvAddSourceStatusComponent,
    TvKeyboardInputDirective,
    TvOnscreenKeyboardComponent,
} from '@iptvnator/tv/ui';
import { TvAddSourceService, TvLiveCatalogFacade } from '@iptvnator/tv/data-access';
import type { GridFocusDirection, TvAddSourceType } from '@iptvnator/tv/util';
import {
    TvAddSourceController,
    type TvAddSourceSubmitResult,
} from './tv-add-source.controller';

const TAB_LABEL: Readonly<Record<TvAddSourceType, string>> = {
    xtream: 'Xtream',
    stalker: 'Stalker',
    m3u: 'M3U',
};
const TAB_TYPES: readonly TvAddSourceType[] = ['xtream', 'stalker', 'm3u'];

/**
 * The real, controller-navigable Add Source screen — replaces the old
 * dev-only `apps/tv/src/app/add-source` harness. Same D-pad input wiring as
 * `TvLiveScreenComponent` (`TvKeyboardInputDirective` + `GamepadInputService`
 * upstream in the route), but its own screen/controller since it's an
 * entirely separate flow.
 */
@Component({
    selector: 'app-tv-add-source-screen',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        TvAddSourceFieldRowComponent,
        TvAddSourceStatusComponent,
        TvKeyboardInputDirective,
        TvOnscreenKeyboardComponent,
    ],
    templateUrl: './tv-add-source-screen.component.html',
    styleUrls: ['./tv-add-source-screen.component.scss'],
})
export class TvAddSourceScreenComponent {
    private readonly router = inject(Router);
    private readonly addSourceService = inject(TvAddSourceService);
    private readonly catalog = inject(TvLiveCatalogFacade);

    protected readonly tabTypes = TAB_TYPES;
    protected readonly tabLabel = TAB_LABEL;

    protected readonly controller = new TvAddSourceController({
        onCancel: () => void this.router.navigateByUrl('/live'),
        onSubmit: (type, values) => this.handleSubmit(type, values),
    });

    protected readonly fields = computed(() => this.controller.fieldsForType());
    protected readonly editingField = computed(() => {
        const id = this.controller.editingFieldId();
        return id === null
            ? null
            : (this.fields().find((field) => field.id === id) ?? null);
    });

    protected onDirection(direction: GridFocusDirection): void {
        this.controller.onDirection(direction);
    }

    protected onActivate(): void {
        this.controller.onActivate();
    }

    protected onBack(): void {
        this.controller.onBack();
    }

    private async handleSubmit(
        type: TvAddSourceType,
        values: Readonly<Record<string, string>>
    ): Promise<TvAddSourceSubmitResult> {
        const outcome = await this.addSourceService.addSource(type, values);
        if (outcome.kind === 'rejected') {
            return { status: 'error', message: outcome.message };
        }
        await this.catalog.addedNewSource(outcome.playlist._id);
        await this.router.navigateByUrl('/live');
        return { status: 'ok' };
    }
}
