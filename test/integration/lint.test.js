'use strict';

const lint = require('../../lint.js');

const commandConfig = {
    quiet: false,
    rules: [],
    skip: []
};

beforeEach(() => {
    jest.resetAllMocks();
});

describe('Lint command', () => {
    describe('properly handles scheme validation', () => {
        test('succesfully validates a valid spec', () => {
            expect.assertions(4);
            const logSpy = jest.spyOn(console, 'log');
            const warnSpy = jest.spyOn(console, 'warn');
            const errorSpy = jest.spyOn(console, 'error');

            return lint.command('./test/fixtures/loader/openapi.yaml', commandConfig).then(() => {
                expect(logSpy).toBeCalledTimes(1);
                expect(logSpy.mock.calls[0][0]).toEqual('\x1b[32mSpecification is valid, with 0 lint errors\x1b[0m');
                expect(warnSpy).toBeCalledTimes(0);
                expect(errorSpy).toBeCalledTimes(0);
            });
        });

        test('displays a validation error on invalid key', () => {
            expect.assertions(4);
            const logSpy = jest.spyOn(console, 'log');
            const warnSpy = jest.spyOn(console, 'warn');
            const errorSpy = jest.spyOn(console, 'error');

            return lint.command('./test/fixtures/integration/invalid-key.yaml', commandConfig).catch(() => {
                expect(logSpy).toBeCalledTimes(0);
                expect(warnSpy).toBeCalledTimes(0);
                expect(errorSpy).toBeCalledTimes(2);
                expect(errorSpy).toHaveBeenCalledWith('\x1b[31mSpecification schema is invalid.\x1b[0m');
            });
        });

        test('displays a validation error on missing reference', () => {
            expect.assertions(4);
            const logSpy = jest.spyOn(console, 'log');
            const warnSpy = jest.spyOn(console, 'warn');
            const errorSpy = jest.spyOn(console, 'error');

            return lint.command('./test/fixtures/integration/missing-ref.yaml', commandConfig).catch(() => {
                expect(logSpy).toBeCalledTimes(0);
                expect(warnSpy).toBeCalledTimes(0);
                expect(errorSpy).toBeCalledTimes(2);
                expect(errorSpy).toHaveBeenCalledWith('\x1b[31mSpecification schema is invalid.\x1b[0m');
            });
        });
    });

    describe('properly handles linter warnings', () => {
        test('displays a linting error on missing contact field', () => {
            expect.assertions(5);
            const logSpy = jest.spyOn(console, 'log');
            const warnSpy = jest.spyOn(console, 'warn');
            const errorSpy = jest.spyOn(console, 'error');

            return lint.command('./test/fixtures/integration/missing-contact.yaml', commandConfig).catch(() => {
                expect(logSpy).toBeCalledTimes(0);
                expect(warnSpy).toBeCalledTimes(1);
                expect(errorSpy).toBeCalledTimes(1);
                expect(errorSpy.mock.calls[0][0]).toEqual('\x1b[31mSpecification contains lint errors: 1\x1b[0m');
                expect(warnSpy.mock.calls[0][0]).toContain('info-contact');
            });
        });
    });
});
