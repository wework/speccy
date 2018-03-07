'use strict';

const path = require('path');
const yaml = require('js-yaml');
const loader = require('../lib/loader.js');

describe('loadSpec()', () => {
    const samplesDir = path.join(__dirname, './samples/');

    it('loads test/samples/openapi.json', () => {
        const spec = loader.loadSpec(samplesDir + 'openapi.json');
        should(spec).have.key('openapi');
    });

    it('loads test/samples/openapi.json with resolver', () => {
        const spec = loader.loadSpec(samplesDir + 'openapi.json', { resolve: true });
        should(spec).have.key('openapi');
    });

    it('loads test/samples/openapi.yaml', () => {
        const spec = loader.loadSpec(samplesDir + 'openapi.yaml');
        should(spec).have.key('openapi');
    });

    it('throws OpenError for test/samples/nope.yaml', () => {
        let thrownError;
        try {
            loader.loadSpec(samplesDir + 'nope.yaml');
        }
        catch (error) {
            thrownError = error;
        }
        should(thrownError.name).equal('OpenError');
    });

    it('throws OpenError for test/samples/not-openapi.csv', () => {
        let thrownError;
        try {
            loader.loadSpec(samplesDir + 'not-openapi.txt');
        }
        catch (error) {
            thrownError = error;
        }
        should(thrownError.name).equal('ReadError');
    });
});
