#!/usr/bin/env node

'use strict';

const fs = require('fs');
const yaml = require('js-yaml');
const config = require('./lib/config.js');
const loader = require('./lib/loader.js');
const resolver = require('oas-resolver');
const fromJsonSchema = require('json-schema-to-openapi-schema');

const command = async (file, cmd) => {
    config.init(cmd);
    const jsonSchema = config.get('jsonSchema');
    const output = config.get('resolve:output');
    const verbose = config.get('quiet') ? -1 : config.get('verbose');

    const spec = await loader.readOrError(file, buildLoaderOptions(jsonSchema, verbose));
    const content = yaml.safeDump(spec, { lineWidth: -1 });

    if (output) {
        fs.writeFile(output, content, 'utf8', () => {
            if (verbose) console.log('Resolved to ' + output);
        });
        return;
    }

    console.log(content);
};

const buildLoaderOptions = (jsonSchema, verbose) => {
    const options = {
        resolve: true,
        cache: [],
        externals: [],
        externalRefs: {},
        rewriteRefs: true,
        status: 'undefined',
        filters: [],
        verbose: verbose,
    };
    if (jsonSchema) options.filters.push(fromJsonSchema);
    return options;
}

module.exports = { command }
