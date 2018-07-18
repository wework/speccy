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

const launchServer = (app, port, specFile) => {
    app.listen(port, () => {
        console.log(`API docs server running on http://localhost:${port}!`);
    })
    .on('error', e => {
        console.error('Failed to start server: ' + e.message);
        process.exit(1);
    });
}

const command = async (specFile, cmd) => {
    config.init(cmd);
    const jsonSchema = config.get('jsonSchema');
    const verbose = config.get('quiet') ? 0 : (config.get('verbose') ? 2 : 1);
    const port = config.get('serve:port', DEFAULT_PORT);

    const app = express();
    const bundleDir = path.dirname(require.resolve('redoc'));
    const html = htmlOrError(specFile);

    const spec = await loader.readOrError(
        specFile,
        buildLoaderOptions(jsonSchema, verbose)
    );

    app.use('/assets/redoc', express.static(bundleDir));
    app.get('/spec.json', (req, res) => {
        res.send(JSON.stringify(spec));
    });
    app.get('/', (req, res) => {
        res.send(html);
    });

    launchServer(app, port, specFile);
}

const buildLoaderOptions = (jsonSchema, verbose) => {
    const options = {
        resolve: true,
        verbose,
        filters: [],
    };
    if (jsonSchema) options.filters.push(fromJsonSchema);
    return options;
}

module.exports = { command };
