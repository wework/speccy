'use strict';

const path = require('path');
const yaml = require('js-yaml');
const loader = require('../lib/loader.js');
const nock = require('nock');
const fetch = require('node-fetch');

describe('loader.js', () => {
    describe('loadRuleFiles()', () => {
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
            loader.loadRuleFiles(['default']).should.be.fulfilledWith(['default']);
        });

        it('load strict rules', () => {
            loader.loadRuleFiles(['strict']).should.be.fulfilledWith(['strict', 'default']);
        });

        it('load wework rules', () => {
            loader.loadRuleFiles(['wework']).should.be.fulfilledWith(['wework', 'strict', 'default']);
        });

        context('when loading from url', () => {
            const host = 'http://example.org';

            it('retrieves rules from valid url', () => {
                nock(host).get('/').replyWithFile(200, __dirname + '/../rules/strict.json', {
                    'Content-Type': 'application/json'
                });

                loader.loadRuleFiles([host + '/']).should.be.fulfilledWith([host + '/', 'default']);
            });

            it('no idea what happens on invalid url', () => {
                nock(host).get('/').reply(404, 'Not Found');
                const url = host + '/';
                loader.loadRuleFiles([url]).should.be.rejectedWith('FetchError');
            });
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
