#!/usr/bin/env node

'use strict';

process.env["NODE_CONFIG_DIR"] = "./.speccy";
process.env["SUPPRESS_NO_CONFIG_WARNING"] = true;

const config = require('config');
const express = require('express');
const path = require('path');
const server = require('./lib/server.js');
const loader = require('./lib/loader.js');

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
    if (config.has('global.jsonSchema')) {
        cmd.jsonSchema = config.get('global.jsonSchema');
    }
    const app = express();
    const verbose = cmd.quiet ? 1 : cmd.verbose;
    const bundleDir = path.dirname(require.resolve('redoc'));

    const html = htmlOrError(specFile);
    const spec = await loader.readOrError(specFile, {
        jsonSchema: cmd.jsonSchema === true,
        resolve: true,
        verbose
    });

    let port = cmd.port;

    if (config.has('serve.port')) {
      port = config.get('serve.port');
    }

    app.use('/assets/redoc', express.static(bundleDir));
    app.get('/spec.json', (req, res) => {
        res.send(JSON.stringify(spec));
    });
    app.get('/', (req, res) => {
        res.send(html);
    });

    launchServer(app, port, specFile);
}

module.exports = { command };
