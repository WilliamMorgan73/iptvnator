import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { TvLiveChannel } from '@iptvnator/tv/util';
import { TvChannelInfoOverlayComponent } from './tv-channel-info-overlay.component';

function channel(overrides: Partial<TvLiveChannel> = {}): TvLiveChannel {
    return {
        id: '1',
        name: 'Nova Sports 1',
        categoryId: 'sports',
        sourceKind: 'xtream',
        playRef: null,
        ...overrides,
    };
}

@Component({
    imports: [TvChannelInfoOverlayComponent],
    template: `<app-tv-channel-info-overlay
        [channel]="channel()"
        [visible]="visible()"
    />`,
})
class HostComponent {
    channel = signal<TvLiveChannel | null>(null);
    visible = signal(false);
}

describe('TvChannelInfoOverlayComponent', () => {
    function createHost() {
        const fixture = TestBed.createComponent(HostComponent);
        fixture.detectChanges();
        return fixture;
    }

    beforeEach(() => {
        TestBed.configureTestingModule({ imports: [HostComponent] });
    });

    it('renders nothing when no channel is given', () => {
        const fixture = createHost();
        expect(
            fixture.nativeElement.querySelector('.tv-channel-info-overlay')
        ).toBeNull();
    });

    it('shows the channel name, number and badge initials', () => {
        const fixture = createHost();
        fixture.componentInstance.channel.set(
            channel({ channelNumber: 101 })
        );
        fixture.detectChanges();

        const el = fixture.nativeElement;
        expect(
            el.querySelector('.tv-channel-info-overlay__name').textContent
        ).toContain('Nova Sports 1');
        expect(
            el.querySelector('.tv-channel-info-overlay__number').textContent
        ).toContain('101');
        expect(
            el.querySelector('.tv-channel-info-overlay__badge').textContent
        ).toContain('NS');
    });

    it('shows the logo image instead of initials when logoUrl is known', () => {
        const fixture = createHost();
        fixture.componentInstance.channel.set(
            channel({ logoUrl: 'https://logos.test/nova-sports.png' })
        );
        fixture.detectChanges();

        const el = fixture.nativeElement;
        const img = el.querySelector('.tv-channel-info-overlay__logo');
        expect(img).not.toBeNull();
        expect(img.src).toBe('https://logos.test/nova-sports.png');
        expect(
            el
                .querySelector('.tv-channel-info-overlay__badge')
                .textContent.trim()
        ).toBe('');
    });

    it('falls back to initials when the logo image fails to load', () => {
        const fixture = createHost();
        fixture.componentInstance.channel.set(
            channel({ logoUrl: 'https://logos.test/broken.png' })
        );
        fixture.detectChanges();

        const el = fixture.nativeElement;
        el.querySelector('.tv-channel-info-overlay__logo').dispatchEvent(
            new Event('error')
        );
        fixture.detectChanges();

        expect(
            el.querySelector('.tv-channel-info-overlay__logo')
        ).toBeNull();
        expect(
            el.querySelector('.tv-channel-info-overlay__badge').textContent
        ).toContain('NS');
    });

    it('retries the logo on a channel switch even after a previous one failed', () => {
        const fixture = createHost();
        fixture.componentInstance.channel.set(
            channel({ logoUrl: 'https://logos.test/broken.png' })
        );
        fixture.detectChanges();
        fixture.nativeElement
            .querySelector('.tv-channel-info-overlay__logo')
            .dispatchEvent(new Event('error'));
        fixture.detectChanges();

        fixture.componentInstance.channel.set(
            channel({
                id: '2',
                logoUrl: 'https://logos.test/another.png',
            })
        );
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector(
                '.tv-channel-info-overlay__logo'
            )
        ).not.toBeNull();
    });

    it('shows the empty state when there is no current programme', () => {
        const fixture = createHost();
        fixture.componentInstance.channel.set(channel());
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector(
                '.tv-channel-info-overlay__empty'
            ).textContent
        ).toContain('No programme information available');
    });

    it('shows programme title, time range, progress and description when known', () => {
        const fixture = createHost();
        fixture.componentInstance.channel.set(
            channel({
                currentProgramTitle: 'The Big Match',
                currentProgramDescription: 'Live coverage.',
                currentProgramStart: '2026-01-01T20:00:00.000Z',
                currentProgramStop: '2026-01-01T22:00:00.000Z',
                currentProgramProgress: 0.25,
            })
        );
        fixture.detectChanges();

        const el = fixture.nativeElement;
        expect(
            el.querySelector('.tv-channel-info-overlay__program-title')
                .textContent
        ).toContain('The Big Match');
        expect(
            el.querySelector('.tv-channel-info-overlay__description')
                .textContent
        ).toContain('Live coverage.');
        expect(
            el
                .querySelector('.tv-channel-info-overlay__progress-fill')
                .style.width
        ).toBe('25%');
        expect(
            el.querySelector('.tv-channel-info-overlay__empty')
        ).toBeNull();
    });

    it('toggles the visible modifier class from the visible input', () => {
        const fixture = createHost();
        fixture.componentInstance.channel.set(channel());
        fixture.detectChanges();
        const overlay = () =>
            fixture.nativeElement.querySelector('.tv-channel-info-overlay');

        expect(overlay().classList).not.toContain(
            'tv-channel-info-overlay--visible'
        );

        fixture.componentInstance.visible.set(true);
        fixture.detectChanges();
        expect(overlay().classList).toContain(
            'tv-channel-info-overlay--visible'
        );
    });
});
