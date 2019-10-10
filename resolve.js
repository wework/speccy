#!/usr/bin/env node

'use strict';

const fs = require('fs');
const yaml = require('yaml');
const config = require('./lib/config.js');
const loader = require('./lib/loader.js');
const fromJsonSchema = require('json-schema-to-openapi-schema');

const command = async (file, cmd) => {
    config.init(cmd);
    const jsonSchema = config.get('jsonSchema');
    const output = config.get('resolve:output');
    const verbose = config.get('quiet') ? 0 : config.get('verbose', 1);
    const internalRefs = config.get('resolve:internalRefs');
    const yamlVersion = config.get('yamlVersion');
    const options = yamlVersion ? { version: yamlVersion } : undefined;

    const spec = await loader.readOrError(
        file,
        buildLoaderOptions(jsonSchema, verbose, internalRefs, yamlVersion)
    );

    const content = yaml.stringify(spec, options);

    return new Promise((resolve, reject) => {
        if (output) {
            fs.writeFile(output, content, 'utf8', err => {
                if (err) {
                    if (verbose) console.error('Failed to write file: ' + err.message);
                    reject();
                } else {
                    if (verbose) console.error('Resolved to ' + output);
                    resolve();
                }
            });
        } else {
            process.stdout.write(content, () => {
                // Do not exit until the output is flushed (e.g. pipes)
                resolve();
            });
        }
    });
};

const buildLoaderOptions = (jsonSchema, verbose, internalRefs, yamlVersion) => {
    const options = {
        resolve: true,
        cache: [],
        externals: [],
        externalRefs: {},
        rewriteRefs: true,
        status: 'undefined',
        filters: [],
        verbose,
    };
    if (jsonSchema) options.filters.push(fromJsonSchema);
    if (yamlVersion) options.yamlVersion = yamlVersion;
    if (internalRefs) options.resolveInternal = true;
    
    return options;
}

module.exports = { command };
