const fs = require('fs');
const path = require('path');
const assert = require('assert');
const yaml = require('js-yaml');

const swagger2openapi = require('../');

const tests = fs.readdirSync(__dirname).filter(file => {
    return fs.statSync(path.join(__dirname, file)).isDirectory()
});

tests.forEach((test) => {
    describe(test, () => {
        it('should match expected output', (done) => {
            const swagger = yaml.safeLoad(fs.readFileSync(path.join(__dirname, test, 'swagger.yml').toString()));
            const openapi = yaml.safeLoad(fs.readFileSync(path.join(__dirname, test, 'openapi.yml').toString()));

            swagger2openapi.convertObj(swagger, {}, (err, result) => {
                if (err) return done(err);

                assert.deepEqual(result.openapi, openapi);

                return done();
            });
        });
    });
});
