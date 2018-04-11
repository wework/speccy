#!/usr/bin/env node

'use strict';

const fs = require('fs');
const yaml = require('js-yaml');
const fetch = require('node-fetch');
const resolver = require('./lib/resolver.js');

const options = {
    resolve: true,
    cache: [],
    externals: [],
    externalRefs: {},
    rewriteRefs: true,
    status: 'undefined',
};

const main = (str, output) => {
    options.openapi = yaml.safeLoad(str,{json:true});
    resolver.resolve(options)
        .then(function(){
            fs.writeFileSync(output, yaml.safeDump(options.openapi,{lineWidth:-1}),'utf8');
            console.log('Resolved to ' + output);
            process.exit(0);
        })
        .catch(function(err){
            console.warn(err);
        });
};

const command = (file, cmd) => {
    options.origin = file;
    options.source = file;
    options.verbose = cmd.quiet ? 1 : cmd.verbose;

    if (file && file.startsWith('http')) {
        if (options.verbose) {
            console.log('GET ' + file);
        }
        fetch(file, { agent:options.agent }).then(res => {
            if (res.status !== 200) throw new Error(`Received status code ${res.status}`);
            return res.text();
        }).then(body => {
            main(body, cmd.output);
        }).catch(err => {
            console.warn(err);
        });
    }
    else {
        if (options.verbose) {
            console.log('READ ' + file);
        }
        fs.readFile(file, 'utf8', (err,data) => {
            if (err)
                console.warn(err);
            else
                main(data, cmd.output);
        });
    }
};

module.exports = { command }
