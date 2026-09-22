import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TvKeyboardInputDirective } from './tv-keyboard-input.directive';

@Component({
    imports: [TvKeyboardInputDirective],
    template: `<div
        appTvKeyboardInput
        (direction)="directions.push($event)"
        (activate)="onActivate()"
        (back)="onBack()"
        (categoryStep)="categorySteps.push($event)"
        (toggleSources)="toggleSourcesCount = toggleSourcesCount + 1"
        (toggleInfo)="toggleInfoCount = toggleInfoCount + 1"
        (openSettings)="openSettingsCount = openSettingsCount + 1"
    >
        <input data-testid="text-field" />
    </div>`,
})
class HostComponent {
    directions: string[] = [];
    activations = 0;
    backs = 0;
    categorySteps: string[] = [];
    toggleSourcesCount = 0;
    toggleInfoCount = 0;
    openSettingsCount = 0;

    onActivate(): void {
        this.activations += 1;
    }

    onBack(): void {
        this.backs += 1;
    }
}

function dispatchKey(
    key: string,
    init: KeyboardEventInit = {},
    target: EventTarget = document.body
): void {
    target.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
    );
}

describe('TvKeyboardInputDirective', () => {
    let host: HostComponent;

    beforeEach(() => {
        TestBed.configureTestingModule({ imports: [HostComponent] });
        const fixture = TestBed.createComponent(HostComponent);
        fixture.detectChanges();
        host = fixture.componentInstance;
    });

    it.each([
        ['ArrowUp', 'up'],
        ['ArrowDown', 'down'],
        ['ArrowLeft', 'left'],
        ['ArrowRight', 'right'],
    ])('emits direction %s -> %s', (key, expected) => {
        dispatchKey(key);
        expect(host.directions).toEqual([expected]);
    });

    it('emits activate on Enter', () => {
        dispatchKey('Enter');
        expect(host.activations).toBe(1);
    });

    it('emits back on Escape', () => {
        dispatchKey('Escape');
        expect(host.backs).toBe(1);
    });

    it.each([
        ['PageUp', 'previous'],
        ['PageDown', 'next'],
    ])('emits categoryStep %s -> %s', (key, expected) => {
        dispatchKey(key);
        expect(host.categorySteps).toEqual([expected]);
    });

    it('emits toggleSources on Tab', () => {
        dispatchKey('Tab', { code: 'Tab' });
        expect(host.toggleSourcesCount).toBe(1);
    });

    it('emits toggleInfo on I', () => {
        dispatchKey('i', { code: 'KeyI' });
        expect(host.toggleInfoCount).toBe(1);
    });

    it('emits openSettings on S', () => {
        dispatchKey('s', { code: 'KeyS' });
        expect(host.openSettingsCount).toBe(1);
    });

    it('ignores unrelated keys', () => {
        dispatchKey('a');
        expect(host.directions).toEqual([]);
        expect(host.activations).toBe(0);
        expect(host.backs).toBe(0);
        expect(host.categorySteps).toEqual([]);
    });

    it('ignores keys with a modifier held', () => {
        dispatchKey('ArrowDown', { ctrlKey: true });
        dispatchKey('ArrowDown', { metaKey: true });
        dispatchKey('ArrowDown', { altKey: true });
        expect(host.directions).toEqual([]);
    });

    it('ignores keys targeting an interactive element', () => {
        const input = document.querySelector(
            '[data-testid="text-field"]'
        ) as HTMLInputElement;
        dispatchKey('ArrowDown', {}, input);
        expect(host.directions).toEqual([]);
    });

    it('ignores an already-handled event', () => {
        const event = new KeyboardEvent('keydown', {
            key: 'ArrowUp',
            bubbles: true,
            cancelable: true,
        });
        event.preventDefault();
        document.body.dispatchEvent(event);
        expect(host.directions).toEqual([]);
    });
});
