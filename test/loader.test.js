'use strict';

const fetch = require('node-fetch');
const loader = require('../lib/loader.js');
const nock = require('nock');
const path = require('path');
const yaml = require('js-yaml');
const fromJsonSchema = require('json-schema-to-openapi-schema');

describe('loader.js', () => {
    describe('loadRuleFiles()', () => {
        it('load default rules', () => {
            loader.loadRuleFiles(['default']).should.be.fulfilledWith(['default']);
        });

        it('load strict rules', () => {
            loader.loadRuleFiles(['strict']).should.be.fulfilledWith(['strict', 'default']);
        });


        it('load default & strict rules', () => {
            loader.loadRuleFiles(['strict', 'default']).should.be.fulfilledWith(['strict', 'default']);
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

        it('resolves JSON Schema $refs when passed { filters: [ jsonSchema ] }', async () => {
            //const filters = [ function(data,options) { console.log(data); return data; } ];
            const filters = [ fromJsonSchema ];
            const spec = await loader.loadSpec(samplesDir + 'json-schema/openapi.yaml', {
                filters: filters,
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

        it('throws ReadError for invalid YAML/JSON', () => {
            loader.loadSpec(samplesDir + 'not-openapi.txt').should.be.rejectedWith(loader.ReadError);
        });
    });
});
