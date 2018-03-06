#!/usr/bin/env node

'use strict';

const fs = require('fs');
const yaml = require('js-yaml');
const fetch = require('node-fetch');

const resolver = require('./lib/resolver.js');

const main = (str, output) => {
    options.openapi = yaml.safeLoad(str,{json:true});
    resolver.resolve(options)
    .then(function(){
        options.status = 'resolved';
        fs.writeFileSync(output, yaml.safeDump(options.openapi,{lineWidth:-1}),'utf8');
        console.log('Resolved to ' + output);
        process.exitCode = 0;
    })
    .catch(function(err){
        options.status = 'rejected';
        console.warn(err);
    });
};

const options = {
    resolve: true,
    cache: [],
    externals: [],
    externalRefs: {},
    rewriteRefs: true,
    status: 'undefined',
};

const command = (filespec, cmd) => {
    options.verbose = cmd.verbose;
    options.origin = filespec;
    options.source = filespec;
    if (cmd.quiet) {
        options.verbose = 1;
    }

    if (filespec && filespec.startsWith('http')) {
        console.log('GET ' + filespec);
        fetch(filespec, {agent:options.agent}).then(function (res) {
            if (res.status !== 200) throw new Error(`Received status code ${res.status}`);
            return res.text();
        }).then(function (body) {
            main(body, cmd.output);
        }).catch(function (err) {
            console.warn(err);
        });
    }
    else {
        fs.readFile(filespec,'utf8',function(err,data){
            if (err) {
                console.warn(err);
            }
            else {
                main(data, cmd.output);
            }
        });
    }
};

module.exports = { command }
