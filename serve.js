#!/usr/bin/env node

'use strict';

const browserSync = require('browser-sync');
const ejs = require('ejs');
const express = require('express');
const fs = require('fs');
const yaml = require('js-yaml');

const command = (file, cmd) => {
    if (!file) {
      console.error('no spec file path');
      cmd.help();
    }

    const app = express();
    const html = loadHTML(file);
    const port = cmd.port;

    app.use('/assets/redoc', express.static(__dirname + '/node_modules/redoc/bundles'))

    app.get('/spec.json', function (req, res) {
        const spec = loadSpec(file);
        res.send(spec);
    });
    app.get('*', function (req, res) {
        res.send(html);
    });

    if (cmd.watch) {
        app.listen(port + 1, function () {
            const bs = browserSync.create();
            bs.init({
                files: [file],
                proxy: `http://localhost:${port+1}`,
                port,
                logLevel: 'silent',
                open: false
            }, function() {
                console.log(`API Reference Doc server running on http://localhost:${port}!`);
            });
        })
        .on('error', function(e) {
            console.error('failed to start server: ' + e.message);
            process.exit(1);
        });
    }
    else {
        app.listen(port, function () {
            console.log(`API Reference Doc server running on http://localhost:${port}!`);
        })
        .on('error', function(e) {
            console.error('failed to start server: ' + e.message);
            process.exit(1);
        });
    }
}

function loadSpec(path) {
    let yml;
    let json;
    if (path.match(/\.(yaml|yml)$/)) {
        try {
            yml = yaml.safeLoad(fs.readFileSync(path, 'utf8'));
        }
        catch (e) {
            console.error('failed to load spec yaml: ' + e.message);
        }
        try {
            json = JSON.stringify(yml);
        }
        catch (e) {
            console.error('failed to convert yaml to json: ' + e.message);
        }
    }
    else {
        try {
            json = fs.readFileSync(path, 'utf8');
        }
        catch (e) {
            console.error('failed to load spec json: ' + e.message);
        }
    }
    return json;
}

function loadHTML(file) {
    let html;
    try {
        const template = fs.readFileSync(__dirname + '/templates/index.html', 'utf8');
        html = ejs.render(template, {spec: file});
    }
    catch (e) {
        console.error('failed to load html file: ' + e.message);
        process.exit(1);
    }
    return html;
}

module.exports = { command }
