'use strict';

const path = require('path');
const loader = require('../lib/loader.js');
const validator = require('../lib/validation-strategies/openapi-v3.js');
const fs = require('fs');

const fetchTestFiles = dir => {
    const allFiles = fs.readdirSync(dir).map(file => {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            return fs.readdirSync(filePath).map(_file => path.join(file, _file));
        }
        return [file];
    });

    // Flatten them out and remove non-openapi files
    return [].concat(...allFiles).filter(file => file.match(/\.(json|yaml|yml)$/));
}

describe('openapi-v3.js', () => {
    describe('validate()', () => {
        const options = { resolve: true };

        context('when provided valid specifications', () => {
            const samplesPath = path.join(__dirname, './validator/openapi-v3/pass');

            fetchTestFiles(samplesPath).forEach(test => {
                it(`${test} is valid`, done => {
                    loader.loadSpec(path.join(samplesPath, test), options).then(spec => {
                        validator.validate(spec, {}, err => {
                            done(err);
                        });
                    }).catch(err => done(err));
                });
            });
        });

        context('when provided invalid specifications', () => {
            const samplesPath = path.join(__dirname, './validator/openapi-v3/fail');

            fetchTestFiles(samplesPath).forEach(test => {
                it(`${test} is invalid`, done => {

                    loader.loadSpec(path.join(samplesPath, test), options).then(spec => {
                        validator.validate(spec, {}, err => {
                            if (err) return done();
                            done(new Error('no validation error'));
                        });
                    }).catch(err => {
                        if (err) return done();
                    });
                });
            });
        });
    });
});
