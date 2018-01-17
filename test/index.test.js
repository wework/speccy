const fs = require('fs');
const path = require('path');
const assert = require('assert');

const swagger2openapi = require('../');

const tests = fs.readdirSync(__dirname).filter(file => {
    return fs.statSync(path.join(__dirname, file)).isDirectory()
});

tests.forEach(async (test) => {
    describe(test, () => {
        it('should match expected output', (done) => {
            const swagger = require(path.join(__dirname, test, 'swagger.json'));
            const openapi = require(path.join(__dirname, test, 'openapi.json'));

            swagger2openapi.convertObj(swagger, {}, (err, result) => {
                if (err) return done(err);

                assert.deepEqual(result.openapi, openapi);

                return done();
            });
        });
    });
});
