#!/usr/bin/env node

'use strict';

const express = require('express');
const path = require('path');
const config = require('./lib/config.js');
const loader = require('./lib/loader.js');
const server = require('./lib/server.js');
const fromJsonSchema = require('json-schema-to-openapi-schema');

const DEFAULT_PORT = 5000;

const htmlOrError = specFile => {
    try {
        return server.loadHTML(specFile);
    }
    catch (e) {
        console.error('Failed to load HTML file: ' + e.message);
        process.exit(1);
    }
}

const launchServer = (app, port, specFile, { verbose }) => {
    app.listen(port, () => {
        if (verbose > 0) {
            console.log(`API specifications server running!`);
            console.log(`HTML:          http://localhost:${port}`);
            console.log(`JSON Specs:    http://localhost:${port}/spec.json`);
        }
    }).on('error', e => {
        console.error('Failed to start server: ' + e.message);
        process.exit(1);
    });
}

const command = async (specFile, cmd) => {
    config.init(cmd);
    const jsonSchema = config.get('jsonSchema');
    const yamlVersion = config.get('yamlVersion');
    const verbose = config.get('quiet') ? 0 : config.get('verbose', 1);
    const port = config.get('serve:port', DEFAULT_PORT);

    const app = express();
    const bundleDir = path.dirname(require.resolve('redoc'));
    const html = htmlOrError(specFile);

    const spec = await loader.readOrError(
        specFile,
        buildLoaderOptions(jsonSchema, verbose, yamlVersion)
    );

    app.use('/assets/redoc', express.static(bundleDir));
    app.get('/spec.json', (req, res) => {
        res.header('content-type', 'application/vnd.oai.openapi+json');
        res.send(JSON.stringify(spec));
    });
    app.get('/', (req, res) => {
        res.send(html);
    });

    launchServer(app, port, specFile, { verbose });
}

const buildLoaderOptions = (jsonSchema, verbose, yamlVersion) => {
    const options = {
        resolve: true,
        verbose,
        filters: [],
    };
    if (jsonSchema) options.filters.push(fromJsonSchema);
    if (yamlVersion) options.yamlVersion = yamlVersion
    return options;
}

module.exports = { command };
