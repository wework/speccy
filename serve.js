#!/usr/bin/env node

'use strict';

const browserSync = require('browser-sync');
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
    const app = express();
    const port = cmd.port;
    const verbose = cmd.quiet ? 1 : cmd.verbose;
    const bundleDir = path.dirname(require.resolve('redoc'));

    const html = htmlOrError(specFile);
    const spec = await loader.readOrError(specFile, {
        resolve: true,
        verbose
    });

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
