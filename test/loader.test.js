'use strict';

const path = require('path');
const yaml = require('js-yaml');
const loader = require('../lib/loader.js');
const nock = require('nock');

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

        it('retrieves rules from valid url', () => {
            const url = nock('https://example.com')
                        .get('/')
                        .replyWithFile(200, __dirname + '/rules/default.json', { 'Content-Type': 'application/json' });
            const loadedNames = loader.loadRules(url).map(x => x.name)
            should(loadedNames).be.eql(
                expectedRules.default
            );
        });

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
