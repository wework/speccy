'use strict';

const path = require('path');
const yaml = require('js-yaml');
const loader = require('../lib/loader.js');

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
        should(spec.paths.a).have.key('$ref');
    });

    it('resolves refs when passed { resolve: true }', async () => {
        const spec = await loader.loadSpec(samplesDir + 'refs/openapi.yaml', { resolve: true });
        should(spec.paths.a.post.description).equal('Some operation object');
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
