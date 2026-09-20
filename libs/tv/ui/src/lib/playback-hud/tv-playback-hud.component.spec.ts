import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
    TvPlaybackHudComponent,
    type TvPlaybackHudKind,
} from './tv-playback-hud.component';

@Component({
    imports: [TvPlaybackHudComponent],
    template: `<app-tv-playback-hud
        [kind]="kind()"
        [visible]="visible()"
        [volume]="volume()"
        [paused]="paused()"
    />`,
})
class HostComponent {
    kind = signal<TvPlaybackHudKind>('volume');
    visible = signal(false);
    volume = signal(0.5);
    paused = signal(false);
}

describe('TvPlaybackHudComponent', () => {
    beforeEach(() => {
        TestBed.configureTestingModule({ imports: [HostComponent] });
    });

    it('toggles the visible class from the visible input', () => {
        const fixture = TestBed.createComponent(HostComponent);
        fixture.detectChanges();
        const hud = () =>
            fixture.nativeElement.querySelector('.tv-playback-hud');

        expect(hud().classList).not.toContain('tv-playback-hud--visible');

        fixture.componentInstance.visible.set(true);
        fixture.detectChanges();
        expect(hud().classList).toContain('tv-playback-hud--visible');
    });

    it('renders the volume bar at the given fill level', () => {
        const fixture = TestBed.createComponent(HostComponent);
        fixture.detectChanges();
        const fill = fixture.nativeElement.querySelector(
            '.tv-playback-hud__bar-fill'
        );
        expect(fill.style.width).toBe('50%');
    });

    it('shows a play icon when paused, pause icon when playing', () => {
        const fixture = TestBed.createComponent(HostComponent);
        fixture.componentInstance.kind.set('play-pause');
        fixture.componentInstance.paused.set(true);
        fixture.detectChanges();
        expect(
            fixture.nativeElement.querySelector('.tv-playback-hud__bar')
        ).toBeNull();
        const pathBefore = fixture.nativeElement.querySelector(
            '.tv-playback-hud__icon path'
        ).getAttribute('d');

        fixture.componentInstance.paused.set(false);
        fixture.detectChanges();
        const pathAfter = fixture.nativeElement.querySelector(
            '.tv-playback-hud__icon path'
        ).getAttribute('d');

        expect(pathBefore).not.toEqual(pathAfter);
    });
});
