'use strict';

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const rules = require('./rules.js');
const resolver = require('oas-resolver');
const yaml = require('yaml');
const readline = require('readline');
const safeEval = require('safe-eval');

class ExtendableError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name; // TODO get rid of this, just instanceof things is fine
    }
}

class NetworkError extends ExtendableError { }
class OpenError extends ExtendableError { }
class ReadError extends ExtendableError { }

function readFileAsync(filename, encoding) {
    return new Promise((resolve, reject) => {
        fs.readFile(filename, encoding, (err, data) => {
            if (err) reject(err);
            else resolve(data);
        });
    });
}

function readFileStdinAsync() {
    return new Promise((resolve, reject) => {
        const rl = readline.createInterface({
            input: process.stdin
        });
        let lines = [];
        rl.on('line', (line) => {
            lines.push(line);
        });
        rl.on('close', () => {
            resolve(lines.join('\n'));
        });
    });
}

const fetchUrl = async (url) => {
    let response;
    try {
        response = await fetch(url);
    } catch (err) {
        throw new NetworkError(err);
    }

    if (response.ok) {
        return await response.text();
    }
    if (response.status === 404) {
        throw new OpenError('Page not found: ' + url);
    }
    throw new NetworkError('HTTP error: ' + response.status);
};


// file can be null, meaning stdin
function readSpecFile(file, options) {
    if (options.verbose > 1) {
        file ? console.error('GET ' + file) : console.error('GET <stdin>');
    }
    if (!file) {
        // standard input
        return readFileStdinAsync()
            .then(content => {
                if (!options.format || options.format !== 'js') return content;
                const module = {};
                safeEval(content, { module });
                if (!module.exports) throw new Error('JS input did not provide module.exports');
                return module.exports;
            });
    } else if (file && file.startsWith('http')) {
        // remote file
        return fetch(file).then(res => {
            if (res.status !== 200) {
                throw new Error(`Received status code ${res.status}`);
            }
            return res.text();
        })
    } else {
        if (/\.js(on)?$/.test(file)) return Promise.resolve(require(file));

        // local file
        // TODO error handlers?
        return readFileAsync(file, 'utf8');
    }
}

const readOrError = async (file, options = {}) => {
    try {
        return await loadSpec(file, options);
    } catch (error) {
        if (error instanceof OpenError) {
            console.error('Could not open file: ' + error.message);
        } else if (error instanceof ReadError) {
            console.error('Could not read YAML/JSON from file: ' + error.message);
        } else {
            console.error(error.message);
        }
        process.exit(1);
    }
}

const recursivelyLoadRulesets = async (ruleset, loadedRulesets, options) => {
    const { verbose } = options;

    let text;
    // If the ruleset looks like a HTTP URL
    if (ruleset && ruleset.startsWith('http')) {
        if (verbose > 1) console.error('GET ' + ruleset);
        text = await fetchUrl(ruleset);
    }
    else if (fs.existsSync(ruleset)) {
        if (verbose > 1) console.error('READ ' + ruleset);
        text = fs.readFileSync(ruleset, 'utf8');
    }
    else {
        const rulesetFile = path.join(__dirname, '../rules/' + ruleset + '.yaml');
        if (verbose > 1) console.error('READ ' + rulesetFile);
        text = fs.readFileSync(rulesetFile, 'utf8');
    }

    try {
        const data = yaml.parse(text, { prettyErrors: true });

        loadedRulesets.push(ruleset);

        if (typeof data.require == 'string') {
            const requiredLoadedFiles = await recursivelyLoadRulesets(data.require, loadedRulesets, options);
            loadedRulesets = loadedRulesets.concat(requiredLoadedFiles);
        }

        if (data.rules) {
            if (verbose > 1) {
                console.log(`Found ${data.rules.length} rules in ${ruleset}: ${data.rules.map(x => x.name)}`);
            }
            // Create and hold the rules
            rules.createNewRules(data.rules, data.url);
        }

        return loadedRulesets;
    } catch (ex) {
        throw new ReadError(ex.message);
    }
}

async function asyncMap(array, callback) {
    const promises = [];
    for (let index = 0; index < array.length; index++) {
        promises.push(callback(array[index], index, array))
    }
    return Promise.all(promises);
}

const loadRulesets = async (loadFiles, options = {}) => {
    const { verbose } = options;
    const rulesetList = (loadFiles && loadFiles.length > 0 ? loadFiles : ['default']);
    const allDependencies = await asyncMap(rulesetList, ruleset => recursivelyLoadRulesets(ruleset, [], { verbose }));
    const flatDependencies = [].concat(...allDependencies);
    // Unique copy of the array
    return [...(new Set(flatDependencies))];
}

const resolveContent = (openapi, options) => {
    return resolver.resolve(openapi, options.source, {
        ...options,
        resolve: true,
        cache: [],
        externals: [],
        externalRefs: {},
        rewriteRefs: true,
        openapi: openapi,
        verbose: options.verbose > 1,
    });
}

const loadSpec = async (source, options = {}) => {
    options.source = source;
    options.origin = source;
    return await readSpecFile(source, options)
        .then(content => {
            if (typeof content !== 'string') return content;

            try {
                return yaml.parse(content, { prettyErrors: true } );
            } catch (err) {
                throw new ReadError("\nLine: " + err.linePos.start.line + ", col: " + err.linePos.start.col + " " + err.message);
            }
        }, err => {
            throw new OpenError(err.message)
        })
        .then(async unresolved => {
            let resolved = unresolved;
            if (options.resolve === true) {
                resolved = (await resolveContent(unresolved, options)).openapi;
            }
            return resolved;
        }, err => {
            throw err
        });
}

module.exports = {
    loadRulesets,
    loadSpec,
    readOrError,
    NetworkError,
    OpenError,
    ReadError,
};
