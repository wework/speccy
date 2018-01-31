// @ts-check
'use strict';

const fs = require('fs');
const url = require('url');
const pathlib = require('path');

const co = require('co');
const maybe = require('call-me-maybe');
const fetch = require('node-fetch');
const yaml = require('js-yaml');
const jptr = require('reftools/lib/jptr.js');

const common = require('./common.js');
const walkSchema = require('./walkSchema.js').walkSchema;
const statusCodes = require('./statusCodes.js').statusCodes;

// TODO split out into params, security etc
// TODO handle specification-extensions with plugins?

const targetVersion = '3.0.0';
var componentNames; // initialised in main

function findExternalRefs(master,options,actions) {
    common.recurse(master, null, function (obj, key, state) {
        if (common.isRef(obj,key)) {
            if (!obj[key].startsWith('#')) {
                actions.push(common.resolveExternal(master, obj[key], options, function (data, source) {
                    let external = {};
                    external.context = state.path;
                    external.$ref = obj[key];
                    external.original = common.clone(data);
                    external.updated = data;
                    external.source = source;
                    options.externals.push(external);
                    let localOptions = Object.assign({},options,{source:source});
                    findExternalRefs(data,localOptions,actions);
                    if (options.patch && obj.description && !data.description) {
                        data.description = obj.description;
                    }
                    state.parent[state.pkey] = data;
                }));
            }
        }
    });
}

function lintObj(openapi, options, callback) {
    return maybe(callback, new Promise(function (resolve, reject) {
        options.externals = [];
        options.promise = {};
        options.promise.resolve = resolve;
        options.promise.reject = reject;
        if (!options.cache) options.cache = {};

        if (!(openapi.openapi && (typeof openapi.openapi === 'string') && openapi.openapi.startsWith('3.'))) {
            return reject(new Error('Unsupported OpenAPI version: ' + (openapi.openapi ? openapi.openapi : openapi.swagger)));
        }

        options.openapi = common.clone(openapi);
        // fixInfo(options.openapi, options, reject);
        // fixPaths(options.openapi, options, reject);
        let actions = [];
        if (options.resolve) {
            findExternalRefs(options.openapi, options, actions);
        }

        co(function* () {
            // resolve multiple promises in parallel
            for (let action of actions) {
                yield action; // because we can mutate the array
            }
            resolve(options);
        })
        .catch(function (err) {
            reject(err);
        });
        return; // we should have resolved or rejected by now
    }));
}


function lintStr(str, options, callback) {
    return maybe(callback, new Promise(function (resolve, reject) {
        let obj = null;
        try {
            obj = JSON.parse(str);
        }
        catch (ex) {
            try {
                obj = yaml.safeLoad(str, { json: true });
                options.sourceYaml = true;
            }
            catch (ex) { }
        }
        if (obj) {
            options.original = obj;
            lintObj(obj, options)
            .then(options => resolve(options))
            .catch(ex => reject(ex));
        }
        else {
            reject(new Error('Could not parse string'));
        }
    }));
}

function lintUrl(url, options, callback) {
    return maybe(callback, new Promise(function (resolve, reject) {
        if (!options.origin) {
            options.origin = url;
        }
        if (options.verbose) {
            console.log('GET ' + url);
        }
        fetch(url, {agent:options.agent}).then(function (res) {
            if (res.status !== 200) throw new Error(`Received status code ${res.status}`);
            return res.text();
        }).then(function (body) {
            lintStr(body, options)
            .then(options => resolve(options))
            .catch(ex => reject(ex));
        }).catch(function (err) {
            reject(err);
        });
    }));
}

function lintFile(filename, options, callback) {
    return maybe(callback, new Promise(function (resolve, reject) {
        fs.readFile(filename, options.encoding || 'utf8', function (err, s) {
            if (err) {
                reject(err);
            }
            else {
                options.sourceFile = filename;
                lintStr(s, options)
                .then(options => resolve(options))
                .catch(ex => reject(ex));
            }
        });
    }));
}

module.exports = {
    targetVersion,
    lint: lintObj,
    lintObj,
    lintUrl,
    lintStr,
    lintFile,
};
