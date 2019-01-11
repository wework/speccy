'use strict';

const server = require('../lib/server.js');

describe('Server', () => {
    describe('loadHTML()', () => {
        test('is a string of HTML', () => {
            const html = server.loadHTML();
            expect(html).toContain('<html>');
        });
    });
});
