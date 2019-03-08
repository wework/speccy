'use strict';

const fs = require('fs');
const mockStdin = require('mock-stdin');
const lint = require('../../lint.js');

const commandConfig = {
    quiet: false,
    rules: [],
    skip: []
};

beforeEach(() => {
    jest.restoreAllMocks();
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

    describe('properly support stdin and pipes', () => {
        let stdin = null;

        beforeEach(() => {
            stdin = mockStdin.stdin();
        });

        afterEach(() => {
            stdin.restore();
        });

        test('expect errors on lint of empty input', () => {
            process.nextTick(function mockResponse() {
                stdin.end();
            });

            expect.assertions(4);
            const logSpy = jest.spyOn(console, 'log');
            const warnSpy = jest.spyOn(console, 'warn');
            const errorSpy = jest.spyOn(console, 'error');

            // pass null as spec, it will be read from stdin
            return lint.command(null, commandConfig).catch(() => {
                expect(logSpy).toBeCalledTimes(0);
                expect(warnSpy).toBeCalledTimes(0);
                expect(errorSpy).toBeCalledTimes(2);
                expect(errorSpy).toHaveBeenCalledWith('\x1b[31mSpecification schema is invalid.\x1b[0m');
            });
        });

        test('expect errors on lint of invalid input', () => {
            const spec = fs.readFileSync('./test/fixtures/integration/invalid-key.yaml', 'utf8');
            process.nextTick(function mockResponse() {
                stdin.send(spec, 'utf8').end();
            });

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

        test('expect no errors on lint of valid input', () => {
            const spec = fs.readFileSync('./test/fixtures/loader/openapi.yaml', 'utf8');
            process.nextTick(function mockResponse() {
                stdin.send(spec, 'utf8').end();
            });

            expect.assertions(4);
            const logSpy = jest.spyOn(console, 'log');
            const warnSpy = jest.spyOn(console, 'warn');
            const errorSpy = jest.spyOn(console, 'error');

            // pass null as spec, it will be read from stdin
            return lint.command(null, commandConfig).then(() => {
                expect(logSpy).toBeCalledTimes(1);
                expect(logSpy.mock.calls[0][0]).toEqual('\x1b[32mSpecification is valid, with 0 lint errors\x1b[0m');
                expect(warnSpy).toBeCalledTimes(0);
                expect(errorSpy).toBeCalledTimes(0);
            });
        });
    });
});
