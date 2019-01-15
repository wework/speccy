'use strict';

const fetch = require('node-fetch');
const loader = require('../../lib/loader.js');
const nock = require('nock');
const path = require('path');
const yaml = require('js-yaml');
const fromJsonSchema = require('json-schema-to-openapi-schema');

describe('Loader', () => {
    describe('loadRuleFiles()', () => {
        test('load default rules', () => {
            return expect(loader.loadRuleFiles(['default'])).resolves.toEqual(['default']);
        });

        test('load strict rules', () => {
            return expect(loader.loadRuleFiles(['strict'])).resolves.toEqual(['strict', 'default']);
        });

        test('load default & strict rules', () => {
            return expect(loader.loadRuleFiles(['strict', 'default'])).resolves.toEqual(['strict', 'default']);
        });

        describe('when loading from a local file', () => {
            test('retrieves rules from the file', () => {
                const file = __dirname + '/../../rules/strict.json';
                return expect(loader.loadRuleFiles([file])).resolves.toEqual([file, 'default']);
            })
        })

        describe('when loading from url', () => {
            const host = 'http://example.org';
            const url = host + '/';

            test('retrieves rules from valid url', () => {
                nock(host).get('/').replyWithFile(200, __dirname + '/../../rules/strict.json', {
                    'Content-Type': 'application/json'
                });

                return expect(loader.loadRuleFiles([host + '/'])).resolves.toEqual([host + '/', 'default']);
            });

            describe('when the file being loaded is garbage', () => {
                const setupMock = () => nock(host).get('/').reply(200, 'this is not json AT ALL');

                test('reject with a ReadError', () => {
                    setupMock();
                    return expect(loader.loadRuleFiles([url])).rejects.toBeInstanceOf(loader.ReadError);
                });
            })

            describe('when the url is not found', () => {
                const setupMock = () => nock(host).get('/').reply(404);

                test('rejects with an OpenError', () => {
                    setupMock();
                    return expect(loader.loadRuleFiles([url])).rejects.toBeInstanceOf(loader.OpenError);
                });
            });
        });
    });

    describe('loadSpec()', () => {
        const samplesDir = path.join(__dirname, '../fixtures/loader/');

        test('loads json specs', async () => {
            const spec = await loader.loadSpec(samplesDir + 'openapi.json');
            expect(spec).toHaveProperty('openapi');
        });

        test('loads yaml specs', async () => {
            const spec = await loader.loadSpec(samplesDir + 'openapi.yaml');
            expect(spec).toHaveProperty('openapi');
        });

        test('errors when duplicate keys exist', async () => {
            return expect(loader.loadSpec(samplesDir + 'duplicates.yaml'))
                .rejects.toBeInstanceOf(loader.ReadError);
        });

        test('does not resolve references by default', async () => {
            const spec = await loader.loadSpec(samplesDir + 'refs/openapi.yaml');
            expect(spec.paths['/a']).toHaveProperty('$ref');
        });

        test('resolves refs when passed { resolve: true }', async () => {
            const spec = await loader.loadSpec(samplesDir + 'refs/openapi.yaml', { resolve: true });
            expect(spec.paths['/a'].post.description).toEqual('Some operation object');
        });

        test('resolves JSON Schema $refs when passed { filters: [ jsonSchema ] }', async () => {
            const filters = [ fromJsonSchema ];
            const spec = await loader.loadSpec(samplesDir + 'json-schema/openapi.yaml', {
                filters,
                resolve: true
            });

            const properties = spec.paths['/a'].get.responses['200'].content['application/json'].schema.properties;
            expect(properties.foo).toEqual({
                "readOnly": true,
                "type": "string",
                "example": "123"
            });
            expect(properties.bar).toEqual({
                "type": "string",
                "format": "uuid",
                "example": "12345",
                "nullable": true
            });
        });

        test('throws OpenError for non-existant file', async () => {
            return expect(loader.loadSpec(samplesDir + 'nope.yaml'))
                .rejects.toBeInstanceOf(loader.OpenError);
        });

        test('throws ReadError for invalid YAML/JSON', async () => {
            return expect(loader.loadSpec(samplesDir + 'not-openapi.txt'))
                .rejects.toBeInstanceOf(loader.ReadError);
        });
    });
});
