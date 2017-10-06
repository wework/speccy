'use strict';

var crypto = require('crypto');
var fs = require('fs');
var url = require('url');

var fetch = require('node-fetch');
var yaml = require('js-yaml');
var jptr = require('jgexml/jpath.js');

function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function uniqueOnly(value, index, self) {
    return self.indexOf(value) === index;
}

function sha256(s) {
    var shasum = crypto.createHash('sha256');
    shasum.update(s);
    return shasum.digest('hex');
}

String.prototype.toCamelCase = function camelize() {
    return this.toLowerCase().replace(/[-_ \/\.](.)/g, function (match, group1) {
        return group1.toUpperCase();
    });
}

function recurse(object, state, callback) {
    if (!state || (Object.keys(state).length === 0)) {
        state = {};
        state.path = '#';
        state.depth = 0;
        state.pkey = '';
        state.parent = {};
        state.payload = {};
    }
    for (var key in object) {
        var escKey = '/' + jptr.jpescape(key);
        state.key = key;
        var oPath = state.path;
        state.path = (state.path ? state.path : '#') + escKey;
        callback(object, key, state);
        if (typeof object[key] === 'object') {
            var newState = {};
            newState.parent = object;
            newState.path = state.path;
            newState.depth = (state.depth ? state.depth++ : state.depth = 1);
            newState.pkey = key;
            newState.payload = state.payload;
            recurse(object[key], newState, callback);
        }
        state.path = oPath;
    }
}

function getVersion() {
    return require('./package.json').version;
}

function readFileAsync(filename, encoding) {
    return new Promise(function (resolve, reject) {
        fs.readFile(filename, encoding, function (err, data) {
            if (err)
                reject(err);
            else
                resolve(data);
        });
    });
}

function resolveExternal(root, pointer, options, callback) {
    var u = url.parse(options.source);
    var base = options.source.split('/');
    base.pop(); // drop the actual filename
    let fragment = '';
    let fnComponents = pointer.split('#');
    if (fnComponents.length > 1) {
        fragment = '#' + fnComponents[1];
        pointer = fnComponents[0];
    }
    base = base.join('/');
    if (options.verbose) console.log((u.protocol ? 'GET ' : 'file://') + base + '/' + pointer);
    if (u.protocol) {
        return fetch(base + '/' + pointer)
            .then(function (res) {
                return res.text();
            })
            .then(function (data) {
                try {
                    data = yaml.safeLoad(data, { json: true });
                    if (fragment) {
                        data = resolveInternal(data, fragment);
                    }
                }
                catch (ex) { }
                callback(data);
                return data;
            });
    }
    else {
        return readFileAsync(base + '/' + pointer, options.encoding || 'utf8')
        .then(function(data){
            try {
                data = yaml.safeLoad(data, { json: true });
                if (fragment) {
                    data = resolveInternal(data, fragment);
                }
            }
            catch (ex) { }
            callback(data);
            return data;
        });
    }
}

function resolveInternal(root, pointer) {
    return jptr.jptr(root, pointer) || false;
}

const parameterTypeProperties = [
    'format',
    'minimum',
    'maximum',
    'exclusiveMinimum',
    'exclusiveMaximum',
    'minLength',
    'maxLength',
    'multipleOf',
    'minItems',
    'maxItems',
    'uniqueItems',
    'minProperties',
    'maxProperties',
    'additionalProperties',
    'pattern',
    'enum',
    'default'
];

const arrayProperties = [
    'items',
    'minItems',
    'maxItems',
    'uniqueItems'
];

const httpVerbs = [
    'get',
    'post',
    'put',
    'delete',
    'patch',
    'head',
    'options',
    'trace'
];

function sanitise(s) {
    var components = s.split('/');
    components[0] = components[0].replace(/[^A-Za-z0-9_\-\.]+|\s+/gm, '_');
    return components.join('/');
}

function sanitiseAll(s) {
    return sanitise(s.split('/').join('_'));
}

module.exports = {

    clone: clone,
    uniqueOnly: uniqueOnly,
    recurse: recurse,
    sha256: sha256,
    getVersion: getVersion,
    resolveExternal: resolveExternal,
    resolveInternal: resolveInternal,
    parameterTypeProperties: parameterTypeProperties,
    arrayProperties: arrayProperties,
    httpVerbs: httpVerbs,
    sanitise: sanitise,
    sanitiseAll: sanitiseAll

};
