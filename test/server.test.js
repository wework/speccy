'use strict';

const path = require('path');
const yaml = require('js-yaml');
const server = require('../lib/server.js');

describe('loadHTML()', () => {
    it('is a string', () => {
        const html = server.loadHTML();
        should(html).be.String();
    });
});


describe('loadSpec()', () => {
    const samplesDir = path.join(__dirname, './samples/');

    it('loads test/samples/openapi.json', () => {
        const spec = server.loadSpec(samplesDir + 'openapi.json');
        should(yaml.load(spec)).have.key('openapi');
    });

    it('loads test/samples/openapi.yaml', () => {
        const spec = server.loadSpec(samplesDir + 'openapi.yaml');
        should(yaml.load(spec)).have.key('openapi');
    });

    it('throws OpenError for test/samples/nope.yaml', () => {
        let thrownError;
        try {
            server.loadSpec(samplesDir + 'nope.yaml');
        }
        catch (error) {
            thrownError = error;
        }
        should(thrownError.name).equal('OpenError');
    });

    it('throws OpenError for test/samples/not-openapi.csv', () => {
        let thrownError;
        try {
            server.loadSpec(samplesDir + 'not-openapi.txt');
        }
        catch (error) {
            thrownError = error;
        }
        should(thrownError.name).equal('ReadError');
    });
});
