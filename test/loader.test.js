'use strict';

const fetch = require('node-fetch');
const loader = require('../lib/loader.js');
const nock = require('nock');
const path = require('path');
const yaml = require('js-yaml');

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
            const url = host + '/';

            it('retrieves rules from valid url', () => {
                nock(host).get('/').replyWithFile(200, __dirname + '/../rules/strict.json', {
                    'Content-Type': 'application/json'
                });

                loader.loadRuleFiles([host + '/']).should.be.fulfilledWith([host + '/', 'default']);
            });

            context('when the file being loaded is garbage', () => {
                const setupMock = () => nock(host).get('/').reply(200, 'this is not json AT ALL');

                it('reject with a ReadError', () => {
                    setupMock();
                    loader.loadRuleFiles([url]).should.be.rejectedWith(loader.ReadError);
                });

                it('error should be useful', () => {
                    setupMock();
                    loader.loadRuleFiles([url]).should.be.rejectedWith(/Invalid JSON: invalid json response body/);
                });
            })

            context('when the url is not found', () => {
                const setupMock = () => nock(host).get('/').reply(404);

                it('rejects with an OpenError', () => {
                    setupMock();
                    loader.loadRuleFiles([url]).should.be.rejectedWith(loader.OpenError);
                });
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

        it('throws OpenError for non-existant file', () => {
            loader.loadSpec(samplesDir + 'nope.yaml').should.be.rejectedWith(loader.OpenError)
        });

        it('throws ReadError for invalid YAML/JSON', () => {
            loader.loadSpec(samplesDir + 'not-openapi.txt').should.be.rejectedWith(loader.ReadError);
        });
    });
});
