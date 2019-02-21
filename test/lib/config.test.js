'use strict';

const config = require('../../lib/config.js');

describe('Config', () => {
    describe('init()', () => {
        test('does not throw for invalid file', () => {
            const configFile = 'test/fixtures/config/doesnotexist.yaml';
            const f = () => { config.init({ parent: { config: configFile } }); };
            expect(f).not.toThrow();
        });

        describe('with a valid json file', () => {
            const configFile = 'test/fixtures/config/valid.json';

            test('can find expected values', () => {
                config.init({ parent: { config: configFile } });

                expect(config.get('jsonSchema')).toBe(true);
                expect(config.get('serve:port')).toBe(8001);
            });
        });

        describe('with a valid yaml file', () => {
            const configFile = 'test/fixtures/config/valid.yaml';

            test('can find expected values', () => {
                config.init({ parent: { config: configFile } });

                expect(config.get('jsonSchema')).toBe(true);
                expect(config.get('serve:port')).toBe(8001);
            });

            test('will handle array config items', () => {
                expect(config.get('lint:rules')).toEqual([
                    'strict',
                    './some/local/rules.json',
                    'https://example.org/my-rules.json',
                ]);
            });
        });
    });

    describe('load()', () => {
        describe('when an empty file is loaded', () => {
            const configFile = 'test/fixtures/config/empty.yaml';

            describe('and no config options are supplied', () => {
                test('it will have undefined values', () => {
                    config.load(configFile, {});
                    expect(config.get('foo:bar')).toBeUndefined();
                });
            });

            describe('and config options are supplied', () => {
                test('with an empty file', () => {
                    config.load(configFile, { foo: { bar: 123 }});
                    expect(config.get('foo:bar')).toBe(123);
                });
            });
        });
    });

    describe('arguments priority', () => {
        describe('arguments have higher priority than config file', () => {
            const configFile = 'test/fixtures/config/valid.yaml';

            test('can override config values with arguments', () => {
                config.init({
                    jsonSchema: false,
                    verbose: 3,
                    rules: ['foo'],
                    port: 5555,
                    parent: {
                        config: configFile
                    }
                });

                expect(config.get('serve:port')).toBe(5555);
                expect(config.get('jsonSchema')).toBe(false);
                expect(config.get('verbose')).toBe(3);
                expect(config.get('lint:rules')).toEqual(['foo']);
                expect(config.get('lint:skip')).toEqual(['info-contact']);
            });

        });
    });
});
