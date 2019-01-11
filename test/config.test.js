'use strict';

const config = require('../lib/config.js');

describe('Config', () => {
    describe('init()', () => {
        test('does not throw for invalid file', () => {
            const configFile = 'test/config/doesnotexist.yaml';
            const f = () => { config.init({ config: configFile }); }
            expect(f).not.toThrow;
        });

        describe('with a valid json file', () => {
            const configFile = 'test/config/valid.json';

            test('can find expected values', () => {
                config.init({ config: configFile });

                expect(config.get('jsonSchema')).toBe(true);
                expect(config.get('serve:port')).toBe(8001);
            });
        });

        describe('with a valid yaml file', () => {
            const configFile = 'test/config/valid.yaml';

            test('can find expected values', () => {
                config.init({ config: configFile });

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
            const configFile = 'test/config/empty.yaml';

            describe('and no config options are supplied', () => {
                test('it will have undefined values', () => {
                    config.load(configFile, {});
                    expect(config.get('foo:bar')).toBeUndefined;
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
});
