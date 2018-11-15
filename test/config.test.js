'use strict';

const config = require('../lib/config.js');

describe('Config', () => {
    describe('init()', () => {
        it('does not throw for invalid file', () => {
            const configFile = 'test/config/doesnotexist.yaml';
            should.doesNotThrow(() => { config.init({ config: configFile }); });
        });

        context('with a valid json file', () => {
            const configFile = 'test/config/valid.json';

            it('can find expected values', () => {
                config.init({ config: configFile });

                should(config.get('jsonSchema')).be.eql(true);
                should(config.get('serve:port')).be.eql(8001);
            });
        });

        context('with a valid yaml file', () => {
            const configFile = 'test/config/valid.yaml';

            it('can find expected values', () => {
                config.init({ config: configFile });

                should(config.get('jsonSchema')).be.eql(true);
                should(config.get('serve:port')).be.eql(8001);
            });

            it('will handle array config items', () => {
                should(config.get('lint:rules')).be.eql([
                    'strict',
                    './some/local/rules.json',
                    'https://example.org/my-rules.json',
                ]);

                should(config.get('lint:skip')).be.eql([
                    'info-contact',
                ]);
            });
        });
    });

    describe('load()', () => {
        context('when an empty file is loaded', () => {
            const configFile = 'test/config/empty.yaml';

            context('and no config options are supplied', () => {
                it('it will have undefined values', () => {
                    config.load(configFile, {});
                    should(config.get('foo:bar')).be.undefined;
                });
            });

            context('and config options are supplied', () => {
                it('with an empty file', () => {
                    config.load(configFile, { foo: { bar: 123 }});
                    should(config.get('foo:bar')).be.eql(123);
                });
            });
        });
    });
});
