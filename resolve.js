#!/usr/bin/env node

'use strict';

const fs = require('fs');
const yaml = require('js-yaml');
const loader = require('./lib/loader.js');
const resolver = require('./lib/resolver.js');

const options = {
    resolve: true,
    cache: [],
    externals: [],
    externalRefs: {},
    rewriteRefs: true,
    status: 'undefined',
};

const command = async (file, cmd) => {
    options.jsonSchema = cmd.jsonSchema === true;
    options.verbose = cmd.quiet ? 1 : cmd.verbose;

    const spec = await loader.readOrError(file, options);
    const content = yaml.safeDump(spec, { lineWidth: -1 });

    if (cmd.output) {
        fs.writeFile(cmd.output, content, 'utf8', () => {
            if (options.verbose > 1) {
                console.log('Resolved to ' + cmd.output);
            }
        });
    }
    else {
        console.log(content);
    }
};

module.exports = { command }
