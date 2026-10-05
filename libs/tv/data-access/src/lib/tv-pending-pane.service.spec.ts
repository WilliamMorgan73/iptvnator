import { TvPendingPaneService, type TvPendingPaneTarget } from './tv-pending-pane.service';

function fakeTarget(): TvPendingPaneTarget & Record<keyof TvPendingPaneTarget, jest.Mock> {
    return {
        onToggleSources: jest.fn(),
        onToggleRecent: jest.fn(),
        onToggleRecordings: jest.fn(),
        onToggleSettings: jest.fn(),
    };
}

describe('TvPendingPaneService', () => {
    it('has nothing pending initially', () => {
        const service = new TvPendingPaneService();

        expect(service.consume()).toBeNull();
    });

    it('returns and clears a requested pane on consume', () => {
        const service = new TvPendingPaneService();
        service.request('sources');

        expect(service.consume()).toBe('sources');
        expect(service.consume()).toBeNull();
    });

    it.each([
        ['sources', 'onToggleSources'],
        ['recent', 'onToggleRecent'],
        ['recordings', 'onToggleRecordings'],
        ['settings', 'onToggleSettings'],
    ] as const)('dispatchTo opens the %s pane via %s', (pane, method) => {
        const service = new TvPendingPaneService();
        const target = fakeTarget();
        service.request(pane);

        service.dispatchTo(target);

        expect(target[method]).toHaveBeenCalledTimes(1);
    });

    it('dispatchTo is a no-op when nothing is pending', () => {
        const service = new TvPendingPaneService();
        const target = fakeTarget();

        service.dispatchTo(target);

        expect(target.onToggleSources).not.toHaveBeenCalled();
        expect(target.onToggleRecent).not.toHaveBeenCalled();
        expect(target.onToggleRecordings).not.toHaveBeenCalled();
        expect(target.onToggleSettings).not.toHaveBeenCalled();
    });

    it('dispatchTo consumes the request so a second call is a no-op', () => {
        const service = new TvPendingPaneService();
        const target = fakeTarget();
        service.request('recent');

        service.dispatchTo(target);
        service.dispatchTo(target);

        expect(target.onToggleRecent).toHaveBeenCalledTimes(1);
    });
});
