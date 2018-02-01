'use strict';

const fs = require('fs');
const url = require('url');

const fetch = require('node-fetch');
const yaml = require('js-yaml');
const recurse = require('reftools/lib/recurse.js').recurse;
const jptr = require('reftools/lib/jptr.js').jptr;
const resolveInternal = jptr;
const clone = require('reftools/lib/clone.js').clone;

function hasDuplicates(array) {
    return (new Set(array)).size !== array.length;
}

function getVersion() {
    return require('./package.json').version;
}

function resolveAllInternal(obj,context,options) {
    recurse(obj,{},function(obj,key,state){
        if (isRef(obj,key)) {
            if (obj[key].startsWith('#')) {
                if (options.verbose) console.warn('Internal resolution',obj[key]);
                state.parent[state.pkey] = clone(resolveInternal(context,obj[key]));
            }
        }
    });
    return obj;
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

function isRef(obj,key) {
    return ((key === '$ref') && (typeof obj[key] === 'string'));
}

module.exports = {
    clone,
    hasDuplicates,
    recurse,
    getVersion,
    resolveInternal: jptr,
    resolveAllInternal,
    parameterTypeProperties,
    httpVerbs,
    isRef
};
