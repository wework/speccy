'use strict';

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const linter = require('./linter.js');
const resolver = require('./resolver.js');
const yaml = require('js-yaml');

class ExtendableError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name; // TODO get rid of this, just instanceof things is fine
    }
}

class NetworkError extends ExtendableError {}
class OpenError extends ExtendableError {}
class ReadError extends ExtendableError {}

function flatten(arr) {
  return [].concat(...arr);
}

function readFileAsync(filename, encoding) {
    return new Promise((resolve, reject) => {
        fs.readFile(filename, encoding, (err, data) => {
            if (err) reject(err);
            else resolve(data);
        });
    });
}

const fetchUrl = url => {
    return fetch(url).then(response => {
        if (response.ok) {
            return response.json().catch(error => {
                return Promise.reject(new ReadError('Invalid JSON: ' + error.message));
            });
        }
        if (response.status == 404) {
            return Promise.reject(new OpenError('Page not found: ' + url));
        }
        return Promise.reject(new NetworkError('HTTP error: ' + response.status));
    });
};

function readSpecFile(file, options) {
    if (options.verbose) {
        console.log('GET ' + file);
    }
    if (file && file.startsWith('http')) {
        return fetch(file).then(res => {
            if (res.status !== 200) {
                throw new Error(`Received status code ${res.status}`);
            }
            return res.text();
        })
    }
    else {
        // TODO error handlers?
        return readFileAsync(file, 'utf8').then(data => data);
    }
}

const readOrError = async (file, options = {}) => {
    try {
        return await loadSpec(file, options);
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

const deepLoadRuleFile = async (file, loadedFiles = []) => {
    let data;
    if (file && file.startsWith('http')) {
        data = await fetchUrl(file);
    }
    else {
        const ruleFile = path.join(__dirname, '../rules/' + file + '.json');
        // TODO error handlers?
        const content = fs.readFileSync(ruleFile, 'utf8');
        data = yaml.safeLoad(content, { json: true });
    }

    loadedFiles.push(file);

    if (typeof data.require == 'string') {
        loadedFiles.concat(deepLoadRuleFile(data.require, loadedFiles));
    }

    // Tell the linter about these new rules
    linter.createNewRules(data.rules);

    return loadedFiles;
}

const loadRuleFiles = async (loadFiles) => {
    linter.resetRules();
    const files = (loadFiles.length > 0 ? loadFiles : ['default']);
    const promises = files.map(file => deepLoadRuleFile(file));
    const results = await Promise.all(promises);
    return flatten(results);
}

const resolveContent = (openapi, options) => {
    return resolver.resolve({
        ...options,
        resolve: true,
        cache: [],
        externals: [],
        externalRefs: {},
        rewriteRefs: true,
        openapi: openapi,
    });
}

const loadSpec = async (source, options = {}) => {
    options.source = source;
    options.origin = source;
    return await readSpecFile(source, options)
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
        if (options.resolve === true) {
            resolved = (await resolveContent(unresolved, options)).openapi;
        }
        return resolved;
    }, err => { throw err });
}

module.exports = {
    loadRuleFiles,
    loadSpec,
    readOrError,
    NetworkError,
    OpenError,
    ReadError,
};
