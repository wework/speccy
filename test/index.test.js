const fs = require('fs');
const path = require('path');
const assert = require('assert');

const swagger2openapi = require('../');

const tests = fs.readdirSync(__dirname).filter(file => {
    return fs.statSync(path.join(__dirname, file)).isDirectory()
});

tests.forEach(async (test) => {
    describe(test, () => {
        it('should match expected output', async () => {
            const swagger = require(path.join(__dirname, test, 'swagger.json'));
            const openapi = require(path.join(__dirname, test, 'openapi.json'));

            assert.deepEqual((await swagger2openapi.convertObj(swagger, {})).openapi, openapi);
        });
    });
});
