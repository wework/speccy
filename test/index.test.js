'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const yaml = require('js-yaml');

const speccy = require('../');

const tests = fs.readdirSync(__dirname).filter(file => {
    return fs.statSync(path.join(__dirname, file)).isDirectory() && file !== 'include';
});

tests.forEach((test) => {
    describe(test, () => {
        it('should match expected output', (done) => {
            const openapi = yaml.safeLoad(fs.readFileSync(path.join(__dirname, test, 'openapi.yaml'),'utf8'),{json:true});
            // const violations = yaml.safeLoad(fs.readFileSync(path.join(__dirname, test, 'violations.yaml'),'utf8'),{json:true});

            let options = {};
            try {
                options = yaml.safeLoad(fs.readFileSync(path.join(__dirname, test, 'options.yaml'),'utf8'),{json:true});
                options.source = path.join(__dirname, test, 'openapi.yaml');
            }
            catch (ex) {}

            speccy.lintObj(openapi, options, (err, result) => {
                if (err) return done(err);

                assert.deepEqual(openapi, result.violations);

                return done();
            });
        });
    });
});
