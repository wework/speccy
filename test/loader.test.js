'use strict';

const path = require('path');
const yaml = require('js-yaml');
const loader = require('../lib/loader.js');

describe('loader.js', () => {
    describe('loadRules()', () => {
        const expectedRules = {
            default: [
                "parameter-description",
                "operation-operationId",
                "operation-summary-or-description",
                "operation-tags",
                "server-trailing-slash",
                "openapi-tags",
                "openapi-tags-alphabetical",
                "reference-no-other-properties",
                "example-value-or-externalValue",
                // "reference-components-regex",
                "no-script-tags-in-markdown",
                "info-contact",
                "license-apimatic-bug",
                "no-eval-in-descriptions",
            ],
            strict: [
                "contact-properties",
                "license-url",
                "server-not-example.com",
                "tag-description",
            ],
            wework: [
                "x-tagGroups",
                "short-summary",
            ]
        };

        it('load default rules', () => {
            const loadedNames = loader.loadRules(['default']).map(x => x.name)
            should(loadedNames).be.eql(
                expectedRules.default
            );
        });

        it('load default rules', () => {
            const loadedNames = loader.loadRules(['strict']).map(x => x.name)
            should(loadedNames).be.eql(
                expectedRules['default'].concat(expectedRules['strict'])
            );
        });

        it('load default rules', () => {
            const loadedNames = loader.loadRules(['wework']).map(x => x.name)
            should(loadedNames).be.eql(
                expectedRules['default'].concat(
                    expectedRules['strict'],
                    expectedRules['wework']
                )
            );
        });
    });

    describe('loadSpec()', () => {
        const samplesDir = path.join(__dirname, './samples/');

        it('loads json specs', async () => {
            const spec = await loader.loadSpec(samplesDir + 'openapi.json');
            should(spec).have.key('openapi');
        });

        it('loads yaml specs', async () => {
            const spec = await loader.loadSpec(samplesDir + 'openapi.yaml');
            should(spec).have.key('openapi');
        });

        it('does not resolve references by default', async () => {
            const spec = await loader.loadSpec(samplesDir + 'refs/openapi.yaml');
            should(spec.paths['/a']).have.key('$ref');
        });

        it('resolves refs when passed { resolve: true }', async () => {
            const spec = await loader.loadSpec(samplesDir + 'refs/openapi.yaml', { resolve: true });
            should(spec.paths['/a'].post.description).equal('Some operation object');
        });

        it('resolves JSON Schema $refs when passed { jsonSchema: true }', async () => {
            const spec = await loader.loadSpec(samplesDir + 'json-schema/openapi.yaml', {
                jsonSchema: true,
                resolve: true
            });

            const properties = spec.paths['/a'].get.responses['200'].content['application/json'].schema.properties;
            should(properties.foo).match({
                "readOnly": true,
                "type": "string",
                "example": "123"
            });
            should(properties.bar).match({
                "type": "string",
                "format": "uuid",
                "example": "12345",
                "nullable": true
            });
        });

        it('throws OpenError for non-existant file', async () => {
            let thrownError;
            try {
                await loader.loadSpec(samplesDir + 'nope.yaml');
            }
            catch (error) {
                thrownError = error;
            }
            should(thrownError.name).equal('OpenError');
        });

        it('throws ReadError for invalid YAML/JSON', async () => {
            let thrownError;
            try {
                await loader.loadSpec(samplesDir + 'not-openapi.txt');
            }
            catch (error) {
                thrownError = error;
            }
            should(thrownError.name).equal('ReadError');
        });
    });
});
