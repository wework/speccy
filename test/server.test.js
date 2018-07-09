'use strict';

const server = require('../lib/server.js');

describe('Server', () => {
    describe('loadHTML()', () => {
        it('is a string', () => {
            const html = server.loadHTML();
            should(html).be.String();
        });
    });
});
