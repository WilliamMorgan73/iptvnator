import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';
import {
    PLAYLIST_PARSE_BY_URL,
    type Playlist,
} from '@iptvnator/shared/interfaces';
import {
    RENDERER_PERFORMANCE_PHASE_HOOK_KEY,
    type RendererPerformancePhaseEvent,
} from '@iptvnator/shared/logging';
import { APP_CONFIG } from './app-config.token';
import { CONFIRM_DIALOG_OPENER } from './confirm-dialog-opener.token';
import { ElectronService } from './electron.service';
import { PLAYLIST_M3U_ACTIONS } from './playlist-m3u-actions.token';
import { SettingsStore } from './settings-store.service';

describe('ElectronService performance phases', () => {
    const hookSymbol = Symbol.for(RENDERER_PERFORMANCE_PHASE_HOOK_KEY);
    const electronBridge = {
        fetchPlaylistByUrl: jest.fn(),
        onPlayerError: jest.fn(),
    };
    const playlistActions = { handleAddingPlaylistByUrl: jest.fn() };
    let service: ElectronService;

    beforeEach(() => {
        Object.defineProperty(window, 'electron', {
            configurable: true,
            value: electronBridge,
        });
        electronBridge.fetchPlaylistByUrl.mockReset();
        electronBridge.onPlayerError.mockReset();
        playlistActions.handleAddingPlaylistByUrl.mockReset();

        TestBed.configureTestingModule({
            providers: [
                ElectronService,
                {
                    provide: CONFIRM_DIALOG_OPENER,
                    useValue: jest.fn(),
                },
                {
                    provide: APP_CONFIG,
                    useValue: { production: false, version: 'test' },
                },
                {
                    provide: MatSnackBar,
                    useValue: { open: jest.fn() },
                },
                {
                    provide: SettingsStore,
                    useValue: {
                        getTrustOptions: jest.fn(() => ({
                            trustedInsecureTlsHosts: [],
                            trustedPrivateNetworkEpgUrls: [],
                        })),
                    },
                },
                { provide: PLAYLIST_M3U_ACTIONS, useValue: playlistActions },
                {
                    provide: TranslateService,
                    useValue: { instant: jest.fn((key: string) => key) },
                },
            ],
        });
        service = TestBed.inject(ElectronService);
    });

    afterEach(() => {
        delete (globalThis as unknown as Record<symbol, unknown>)[hookSymbol];
        Object.defineProperty(window, 'electron', {
            configurable: true,
            value: undefined,
        });
    });

    it('marks the initial URL import store dispatch without exposing playlist data', async () => {
        const events: RendererPerformancePhaseEvent[] = [];
        (
            globalThis as unknown as Record<
                symbol,
                (event: RendererPerformancePhaseEvent) => void
            >
        )[hookSymbol] = (event) => events.push(event);
        const playlist = {
            playlist: { items: [{ name: 'Sensitive channel' }] },
            title: 'Sensitive title',
            url: 'https://user:secret@example.test/list.m3u',
        } as Playlist;
        electronBridge.fetchPlaylistByUrl.mockResolvedValue(playlist);

        await service.sendIpcEvent(PLAYLIST_PARSE_BY_URL, {
            title: playlist.title,
            url: playlist.url,
        });
        await Promise.resolve();
        await Promise.resolve();

        expect(playlistActions.handleAddingPlaylistByUrl).toHaveBeenCalledWith({
            isTemporary: false,
            playlist,
        });
        expect(
            events.map(({ boundary, outcome, phase }) => ({
                boundary,
                outcome,
                phase,
            }))
        ).toEqual([
            {
                boundary: 'start',
                outcome: undefined,
                phase: 'store.m3u-import-dispatch',
            },
            {
                boundary: 'end',
                outcome: 'success',
                phase: 'store.m3u-import-dispatch',
            },
        ]);
        expect(JSON.stringify(events)).not.toContain('Sensitive');
        expect(JSON.stringify(events)).not.toContain('secret');
    });
});
