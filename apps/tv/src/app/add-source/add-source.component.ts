import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PlaylistsService } from '@iptvnator/services';
import { createRandomId, type Playlist } from '@iptvnator/shared/interfaces';
import { firstValueFrom } from 'rxjs';

type TvAddSourceType = 'xtream' | 'stalker' | 'm3u';

/**
 * Dev/test-only "add a source" screen — NOT part of tv mode's v1 design
 * (the plan's "Deferred" section explicitly excludes settings screens from
 * v1). Exists so Milestone 3's real adapters can be exercised with a real
 * playlist without needing Electron + the mock servers for every check.
 * Reuses PlaylistsService.addPlaylist()/handlePlaylistParsing() — the same
 * persistence the real import dialogs use — rather than hand-rolling
 * storage. Reachable by navigating to /add-source directly, and from the
 * live screen's "no sources" empty state.
 */
@Component({
    selector: 'app-tv-add-source',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './add-source.component.html',
    styleUrl: './add-source.component.scss',
})
export class AddSourceComponent {
    private readonly playlistsService = inject(PlaylistsService);
    private readonly router = inject(Router);

    readonly sourceType = signal<TvAddSourceType>('xtream');
    readonly saving = signal(false);
    readonly error = signal<string | null>(null);

    readonly serverUrl = signal('');
    readonly username = signal('');
    readonly password = signal('');

    readonly portalUrl = signal('');
    readonly macAddress = signal('');

    readonly m3uTitle = signal('Test M3U');
    readonly m3uText = signal('');

    selectType(type: TvAddSourceType): void {
        this.sourceType.set(type);
        this.error.set(null);
    }

    async submit(): Promise<void> {
        this.error.set(null);
        this.saving.set(true);
        try {
            const playlist = await this.buildPlaylist();
            await firstValueFrom(this.playlistsService.addPlaylist(playlist));
            await this.router.navigateByUrl('/');
        } catch (err) {
            this.error.set(err instanceof Error ? err.message : String(err));
        } finally {
            this.saving.set(false);
        }
    }

    private async buildPlaylist(): Promise<Playlist> {
        const now = new Date().toISOString();
        switch (this.sourceType()) {
            case 'xtream':
                return {
                    _id: createRandomId(),
                    title: `Test Xtream (${this.serverUrl()})`,
                    importDate: now,
                    lastUsage: now,
                    count: 0,
                    autoRefresh: false,
                    serverUrl: this.serverUrl().trim(),
                    username: this.username().trim(),
                    password: this.password(),
                };
            case 'stalker':
                return {
                    _id: createRandomId(),
                    title: `Test Stalker (${this.portalUrl()})`,
                    importDate: now,
                    lastUsage: now,
                    count: 0,
                    autoRefresh: false,
                    portalUrl: this.portalUrl().trim(),
                    macAddress: this.macAddress().trim(),
                };
            case 'm3u':
                return this.playlistsService.handlePlaylistParsing(
                    'TEXT',
                    this.m3uText(),
                    this.m3uTitle().trim() || 'Test M3U'
                );
        }
    }
}
