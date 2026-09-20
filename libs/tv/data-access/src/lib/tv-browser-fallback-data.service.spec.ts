import { TestBed } from '@angular/core/testing';
import { TvBrowserFallbackDataService } from './tv-browser-fallback-data.service';

describe('TvBrowserFallbackDataService', () => {
    function createService(): TvBrowserFallbackDataService {
        TestBed.configureTestingModule({});
        return TestBed.inject(TvBrowserFallbackDataService);
    }

    it('rejects any IPC event instead of crashing', async () => {
        const service = createService();
        await expect(service.sendIpcEvent('XTREAM_REQUEST')).rejects.toThrow(
            'tv mode requires Electron for portal data access'
        );
    });

    it('reports a browser environment', () => {
        expect(createService().getAppEnvironment()).toBe('browser');
    });

    it('never throws from listener management no-ops', () => {
        const service = createService();
        expect(() => service.listenOn('x', () => undefined)).not.toThrow();
        expect(() => service.removeAllListeners('x')).not.toThrow();
    });
});
