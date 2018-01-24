'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const yaml = require('js-yaml');

const swagger2openapi = require('../');

const tests = fs.readdirSync(__dirname).filter(file => {
    return fs.statSync(path.join(__dirname, file)).isDirectory() && file !== 'include';
});

tests.forEach((test) => {
    describe(test, () => {
        it('should match expected output', (done) => {
            const swagger = yaml.safeLoad(fs.readFileSync(path.join(__dirname, test, 'swagger.yaml'),'utf8'),{json:true});
            const openapi = yaml.safeLoad(fs.readFileSync(path.join(__dirname, test, 'openapi.yaml'),'utf8'),{json:true});

            let options = {};
            try {
                options = yaml.safeLoad(fs.readFileSync(path.join(__dirname, test, 'options.yaml'),'utf8'),{json:true});
                options.source = path.join(__dirname, test, 'swagger.yaml');
            }
            catch (ex) {}

            swagger2openapi.convertObj(swagger, options, (err, result) => {
                if (err) return done(err);

                assert.deepEqual(result.openapi, openapi);

                return done();
            });
        });
    });
});
