'use strict';

const path = require('path');
const loader = require('../lib/loader.js');
const validator = require('../lib/validator.js');

describe('validator.js', () => {
    describe('validate()', () => {
        it('can validate tricky example file', done => {
            const samplesDir = path.join(__dirname, './samples/');
            loader.loadSpec(samplesDir + 'openapi.yaml').then(spec => {
                validator.validate(spec, {}, err => {
                    should(err).be.null();
                    done();
                });
            });
        });
    });
});
