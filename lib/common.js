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
    resolveInternal: jptr,
    parameterTypeProperties,
    httpVerbs,
    isRef
};
