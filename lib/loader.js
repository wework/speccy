'use strict';

const fs = require('fs');
const fetch = require('node-fetch');
const yaml = require('js-yaml');
const resolver = require('./resolver.js');

class ExtendableError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}

class OpenError extends ExtendableError {}
class ReadError extends ExtendableError {}

function readFileAsync(filename, encoding) {
    return new Promise((resolve, reject) => {
        fs.readFile(filename, encoding, (err, data) => {
            if (err)
                reject(err);
            else
                resolve(data);
        });
    });
}

function readSpecFile(file) {
    if (file && file.startsWith('http')) {
        return fetch(file).then(res => {
            if (res.status !== 200) {
                throw new Error(`Received status code ${res.status}`);
            }
            return res.text();
        })
    }
    else {
        return readFileAsync(file, 'utf8').then(data => data);
    }
}

const readOrError = async (file) => {
    try {
        return await loadSpec(file, { resolve: true });
    }
    catch (error) {
        if (error instanceof OpenError) {
            console.error('Could not open file: ' + error.message);
        }
        else if (error instanceof ReadError) {
            console.error('Could not read YAML/JSON from file: ' + error.message);
        }
        else {
            console.error(error);
        }
        process.exit(1);
    }
}

const resolveContent = (openapi, source) => {
    const options = {
        resolve: true,
        cache: [],
        externals: [],
        externalRefs: {},
        rewriteRefs: true,
        origin: source,
        source: source
    };

    options.openapi = openapi;

    return resolver.resolve(options);
}

const loadSpec = async (source, opts = {}) => {
    const { resolve = false } = opts;

    return await readSpecFile(source)
        .then(content => {
            try {
                return yaml.load(content, { json: true });
            }
            catch (err) {
                throw new ReadError(err.message);
            }
        }, err => { throw new OpenError(err.message) })
        .then(async unresolved => {
            let resolved = unresolved;
            if (resolve === true) {
                resolved = (await resolveContent(unresolved, source)).openapi;
            }
            return resolved;
        }, err => { throw err });
}

module.exports = {
    loadSpec,
    readOrError
};
