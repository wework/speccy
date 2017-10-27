'use strict';

const crypto = require('crypto');
const fs = require('fs');
const url = require('url');

const fetch = require('node-fetch');
const yaml = require('js-yaml');
const recurse = require('reftools/lib/recurse.js').recurse;
const jptr = require('reftools/lib/jptr.js').jptr;
const resolveInternal = jptr;
const clone = require('reftools/lib/clone.js').clone;

function uniqueOnly(value, index, self) {
    return self.indexOf(value) === index;
}

function hasDuplicates(array) {
    return (new Set(array)).size !== array.length;
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
    var base = options.source.split('\\').join('/').split('/');
    let doc = base.pop(); // drop the actual filename
    if (!doc) base.pop(); // in case it ended with a /
    let fragment = '';
    let fnComponents = pointer.split('#');
    if (fnComponents.length > 1) {
        fragment = '#' + fnComponents[1];
        pointer = fnComponents[0];
    }
    base = base.join('/');

    let u2 = url.parse(pointer);
    let effectiveProtocol = (u2.protocol ? u2.protocol : (u.protocol ? u.protocol : 'file:'));
    if (u2.protocol) pointer = u2.path;

    let target = base+'/'+pointer;

    if (options.cache[target]) {
        if (options.verbose) console.log('CACHED',target);
        let data = options.cache[target];
        if (fragment) {
            data = resolveInternal(data, fragment);
        }
        callback(data);
        return Promise.resolve(data);
    }

    if (options.verbose) console.log('GET',target);

    if (options.handlers && options.handlers[effectiveProtocol]) {
        return options.handlers[effectiveProtocol](base,pointer,fragment,options)
            .then(function(data){
                callback(data);
                return data;
            });
    }
    else if (u.protocol && u.protocol.startsWith('http')) {
        return fetch(target, {agent:options.agent})
            .then(function (res) {
                return res.text();
            })
            .then(function (data) {
                try {
                    data = yaml.safeLoad(data, { json: true });
                    options.cache[target] = data;
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
        return readFileAsync(target, options.encoding || 'utf8')
        .then(function(data){
            try {
                data = yaml.safeLoad(data, { json: true });
                options.cache[target] = data;
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

function isRef(obj,key) {
    return ((key === '$ref') && (typeof obj[key] === 'string'));
}

module.exports = {

    clone: clone,
    uniqueOnly: uniqueOnly,
    hasDuplicates: hasDuplicates,
    recurse: recurse,
    sha256: sha256,
    getVersion: getVersion,
    resolveExternal: resolveExternal,
    resolveInternal: jptr,
    parameterTypeProperties: parameterTypeProperties,
    arrayProperties: arrayProperties,
    httpVerbs: httpVerbs,
    sanitise: sanitise,
    sanitiseAll: sanitiseAll,
    isRef: isRef

};
