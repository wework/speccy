'use strict';

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const resolver = require('./resolver.js');
const wget = require('wget');
const yaml = require('js-yaml');

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
            if (err) reject(err);
            else resolve(data);
        });
    });
}

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

function deepMergeRules(ruleNickname, skipRules, rules = []) {
    const ruleFile = path.join(__dirname, '../rules/' + ruleNickname + '.json');
    const content = fs.readFileSync(ruleFile, 'utf8');
    const data = yaml.safeLoad(content, { json: true });

    if (typeof data.require == 'string') {
        rules = deepMergeRules(data.require, rules);
    }

    for (const r in data.rules) {
        const rule = data.rules[r];
        if (!rule.enabled) continue;
        if (skipRules.indexOf(rule.name) !== -1) continue;
        if (!Array.isArray(rule.object)) rule.object = [rule.object];
        if (rule.alphabetical && rule.alphabetical.properties && !Array.isArray(rule.alphabetical.properties)) {
            rule.alphabetical.properties = [rule.alphabetical.properties];
        }
        if (rule.truthy && !Array.isArray(rule.truthy)) rule.truthy = [rule.truthy];
        rules.push(rule);
    }

    return rules;
}

const loadRules = (loadFiles, skipRules = [], url = []) => {
    if (url.length > 0) {
        loadFiles = fetchRulesUrl(url);
    }

    const files = (loadFiles.length > 0 ? loadFiles : ['default']);
    let loadedRules = [];
    for (const f in files) {
        loadedRules = loadedRules.concat(deepMergeRules(files[f], skipRules));
    }
    return loadedRules;
}

const fetchRulesUrl = (url) => {
  var rules = [];

  for (const u in url) {
    var src = url[u];
    var fileName = src.substring(src.lastIndexOf('/')+1);
    var output = './rules/' + fileName;
    var download = wget.download(src, output);

    download.on('error', function(err) {
      console.log(err);
    });
    download.on('end', function(output) {
      console.log('output');
    });

    rules.push(fileName.substring(0, fileName.lastIndexOf('.')));
  }

  return rules;
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
    fetchRulesUrl,
    loadRules,
    loadSpec,
    readOrError,
};
