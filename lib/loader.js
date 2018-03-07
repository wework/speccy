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
    return new Promise(function (resolve, reject) {
        fs.readFile(filename, encoding, function (err, data) {
            if (err)
                reject(err);
            else
                resolve(data);
        });
    });
}

function readSpecFile(file) {
    if (file && file.startsWith('http')) {
        return fetch(file).then(function (res) {
            if (res.status !== 200) throw new Error(`Received status code ${res.status}`);
            return res.text();
        }).catch(err => { throw new OpenError(err.message) });
    }
    else {
        return readFileAsync(file, 'utf8')
            .then(data => {
                return data;
            })
            .catch(err => { throw new OpenError(err.message) });
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
        // .then(() => {
        //     // console.log(options.openapi, 'resolved')
        //     return options.openapi;
        // })
        // .catch(err => { throw err });
}

const loadSpec = async (source, opts = {}) => {
    const { resolve = false } = opts;

    const foo = await readSpecFile(source)
        .then(content => {
            return yaml.load(content, { json: true });
        }, err => { throw new ReadError(e.message) })
        .then(async unresolved => {
            let resolved = unresolved;

            if (resolve === true) {
                resolved = (await resolveContent(unresolved, source)).openapi;
            }
            // console.log('json', JSON.stringify(resolved))

            return resolved;
        });

    return foo;
}

module.exports = { loadSpec };
