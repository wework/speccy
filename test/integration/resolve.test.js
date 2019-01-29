'use strict';

const resolve = require('../../resolve.js');

beforeEach(() => {
    jest.resetAllMocks();
});

describe('Resolve command', () => {
    describe('properly handles resolving', () => {
        test('succesfully resolves a valid spec to stdout', () => {
            expect.assertions(4);
            const logSpy = jest.spyOn(console, 'log');
            const warnSpy = jest.spyOn(console, 'warn');
            const errorSpy = jest.spyOn(console, 'error');

            return resolve.command('./test/fixtures/loader/openapi.yaml', {}).then(() => {
                expect(logSpy).toBeCalledTimes(1);
                expect(logSpy.mock.calls[0][0]).toEqual('openapi: 3.0.0\n' +
                    'info:\n' +
                    '  contact:\n' +
                    '    name: Derp\n' +
                    '    email: derp@herp.com\n' +
                    '  version: 1.0.0\n' +
                    '  title: Swagger 2.0 Without Scheme\n' +
                    'paths: {}\n' +
                    'tags:\n' +
                    '  - name: Gym\n' +
                    '  - name: Pokemon\n' +
                    ''
                );
                expect(warnSpy).toBeCalledTimes(0);
                expect(errorSpy).toBeCalledTimes(0);
            });
        });
        
        test('succesfully resolves a valid spec to an output file', () => {
            expect.assertions(4);
            const logSpy = jest.spyOn(console, 'log');
            const warnSpy = jest.spyOn(console, 'warn');
            const errorSpy = jest.spyOn(console, 'error');

            return resolve.command('./test/fixtures/loader/openapi.yaml', {
                output: 'resolved.yaml',
            }).then(() => {
                expect(logSpy).toBeCalledTimes(1);
                expect(logSpy.mock.calls[0][0]).toEqual('Resolved to resolved.yaml');
                expect(warnSpy).toBeCalledTimes(0);
                expect(errorSpy).toBeCalledTimes(0);
            });
        });
    });
});
