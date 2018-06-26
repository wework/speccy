'use strict';

const server = require('../lib/server.js');

describe('loadHTML()', () => {
    it('is a string', () => {
        const html = server.loadHTML();
        should(html).be.String();
    });

    context('when config file is loaded', () => {
        process.env["NODE_CONFIG_DIR"] = "./test/samples/config";

        const config = require('config');

        it('accepts the port option when set', () => {
            if (config.has("serve.port")) {
                return true;
            }
        });
    });
});
