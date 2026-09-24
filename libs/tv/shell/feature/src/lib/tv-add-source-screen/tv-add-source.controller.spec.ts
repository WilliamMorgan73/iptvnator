import {
    TvAddSourceController,
    type TvAddSourceConfig,
} from './tv-add-source.controller';

function fakeConfig(
    overrides: Partial<TvAddSourceConfig> = {}
): TvAddSourceConfig & { onSubmit: jest.Mock; onCancel: jest.Mock } {
    return {
        onSubmit: jest.fn().mockResolvedValue({ status: 'ok' }),
        onCancel: jest.fn(),
        ...overrides,
    };
}

describe('TvAddSourceController', () => {
    it('starts on the tabs region with xtream selected and the first tab focused', () => {
        const controller = new TvAddSourceController(fakeConfig());

        expect(controller.region()).toBe('tabs');
        expect(controller.sourceType()).toBe('xtream');
        expect(controller.tabsController.focusedIndex()).toBe(0);
    });

    describe('tab switching', () => {
        it('switches source type and resets fields/status on Activate', () => {
            const controller = new TvAddSourceController(fakeConfig());
            controller.fieldValues.set({ title: 'stale' });
            controller.statusMessage.set('stale error');
            controller.tabsController.move('right');

            controller.onActivate();

            expect(controller.sourceType()).toBe('stalker');
            expect(controller.fieldValues()).toEqual({});
            expect(controller.statusMessage()).toBeNull();
        });

        it('is a no-op when activating the already-selected tab', () => {
            const controller = new TvAddSourceController(fakeConfig());
            controller.fieldValues.set({ title: 'kept' });

            controller.onActivate();

            expect(controller.fieldValues()).toEqual({ title: 'kept' });
        });
    });

    describe('region hand-off', () => {
        it('moves from tabs to fields on Down, focusing the first field', () => {
            const controller = new TvAddSourceController(fakeConfig());

            controller.onDirection('down');

            expect(controller.region()).toBe('fields');
            expect(controller.fieldsController.focusedIndex()).toBe(0);
        });

        it('moves back from the first field row to tabs on Up', () => {
            const controller = new TvAddSourceController(fakeConfig());
            controller.onDirection('down');

            controller.onDirection('up');

            expect(controller.region()).toBe('tabs');
        });

        it('does not leave fields on Up from a row other than the first', () => {
            const controller = new TvAddSourceController(fakeConfig());
            controller.onDirection('down');
            controller.onDirection('down');

            controller.onDirection('up');

            expect(controller.region()).toBe('fields');
            expect(controller.fieldsController.focusedIndex()).toBe(0);
        });
    });

    describe('field editing', () => {
        it('activating a field row begins editing it, seeded from the current value', () => {
            const controller = new TvAddSourceController(fakeConfig());
            controller.fieldValues.set({ serverUrl: 'https://panel.test' });
            controller.onDirection('down'); // -> fields, index 0 (title)
            controller.onDirection('down'); // -> index 1 (serverUrl)

            controller.onActivate();

            expect(controller.isEditing).toBe(true);
            expect(controller.editingFieldId()).toBe('serverUrl');
            expect(controller.editBuffer()).toBe('https://panel.test');
            expect(controller.keyboardController.focusedIndex()).toBe(0);
        });

        it('routes direction/activate to the keyboard while editing', () => {
            const controller = new TvAddSourceController(fakeConfig());
            controller.onDirection('down');
            controller.onActivate(); // editing "title"
            expect(controller.keyboardController.focusedIndex()).toBe(0);

            controller.onDirection('down'); // row 1, index 10 = 'q'
            controller.onActivate();

            expect(controller.editBuffer()).toBe('q');
        });

        it('backspace removes the last character', () => {
            const controller = new TvAddSourceController(fakeConfig());
            controller.onDirection('down');
            controller.onActivate();
            controller.editBuffer.set('ab');
            controller.keyboardController.focusedIndex.set(48); // backspace key
            controller.onActivate();

            expect(controller.editBuffer()).toBe('a');
        });

        it('shift toggles case for subsequent characters', () => {
            const controller = new TvAddSourceController(fakeConfig());
            controller.onDirection('down');
            controller.onActivate();
            controller.keyboardController.focusedIndex.set(46); // shift key
            controller.onActivate();
            expect(controller.keyboardShiftActive()).toBe(true);

            controller.keyboardController.focusedIndex.set(10); // 'q'
            controller.onActivate();

            expect(controller.editBuffer()).toBe('Q');
        });

        it('done commits the buffer into fieldValues and exits editing', () => {
            const controller = new TvAddSourceController(fakeConfig());
            controller.onDirection('down');
            controller.onActivate();
            controller.editBuffer.set('My Title');
            controller.keyboardController.focusedIndex.set(49); // done key

            controller.onActivate();

            expect(controller.isEditing).toBe(false);
            expect(controller.fieldValues()).toEqual({ title: 'My Title' });
        });

        it('Back while editing discards the buffer without committing', () => {
            const controller = new TvAddSourceController(fakeConfig());
            controller.onDirection('down');
            controller.onActivate();
            controller.editBuffer.set('discard me');

            controller.onBack();

            expect(controller.isEditing).toBe(false);
            expect(controller.fieldValues()).toEqual({});
        });
    });

    describe('submit', () => {
        it('activating the synthetic trailing row submits instead of editing a field', async () => {
            const config = fakeConfig();
            const controller = new TvAddSourceController(config);
            controller.onDirection('down');
            const fieldCount = controller.fieldsForType().length;
            for (let i = 0; i < fieldCount; i += 1) {
                controller.onDirection('down');
            }

            controller.onActivate();
            await Promise.resolve();

            expect(controller.isEditing).toBe(false);
            expect(config.onSubmit).toHaveBeenCalledWith('xtream', {});
        });

        it('surfaces the rejection message and stops submitting on failure', async () => {
            const config = fakeConfig({
                onSubmit: jest
                    .fn()
                    .mockResolvedValue({ status: 'error', message: 'Bad URL.' }),
            });
            const controller = new TvAddSourceController(config);
            controller.onDirection('down');
            for (let i = 0; i < controller.fieldsForType().length; i += 1) {
                controller.onDirection('down');
            }

            controller.onActivate();
            await Promise.resolve();

            expect(controller.statusMessage()).toBe('Bad URL.');
            expect(controller.submitting()).toBe(false);
        });

        it('guards against concurrent submits', async () => {
            let resolveSubmit: (value: { status: 'ok' }) => void = () => undefined;
            const config = fakeConfig({
                onSubmit: jest.fn(
                    () =>
                        new Promise((resolve) => {
                            resolveSubmit = resolve;
                        })
                ),
            });
            const controller = new TvAddSourceController(config);
            controller.onDirection('down');
            for (let i = 0; i < controller.fieldsForType().length; i += 1) {
                controller.onDirection('down');
            }

            controller.onActivate();
            expect(controller.submitting()).toBe(true);
            controller.onActivate();

            expect(config.onSubmit).toHaveBeenCalledTimes(1);
            resolveSubmit({ status: 'ok' });
            await Promise.resolve();
        });
    });

    describe('onBack outside editing', () => {
        it('returns from fields to tabs first', () => {
            const config = fakeConfig();
            const controller = new TvAddSourceController(config);
            controller.onDirection('down');

            controller.onBack();

            expect(controller.region()).toBe('tabs');
            expect(config.onCancel).not.toHaveBeenCalled();
        });

        it('calls onCancel from the tabs region', () => {
            const config = fakeConfig();
            const controller = new TvAddSourceController(config);

            controller.onBack();

            expect(config.onCancel).toHaveBeenCalledTimes(1);
        });
    });
});
