#!/usr/bin/env node

'use strict'

const fs = require('fs');
const url = require('url');
const path = require('path');
const config = require('./lib/config.js');
const loader = require('./lib/loader.js');
const linter = require('oas-linter');
const rules = require('./lib/rules.js');
const validator = require('oas-validator');
const fromJsonSchema = require('json-schema-to-openapi-schema');

const colors = process.env.NODE_DISABLE_COLORS ? {} : {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    reset: '\x1b[0m'
};

const formatSchemaError = (err, context) => {
    const pointer = context.pop();
    let output = `
${colors.yellow + pointer}
`;
    
    if (err.name === 'AssertionError' || err.error.name === 'AssertionError') {
        output += colors.reset + truncateLongMessages(err.message);
    }
    else if (err instanceof validator.CLIError) {
        output += colors.reset + err.message;
    }
    else {
        output += colors.red + err.stack;
    }
    return output;
}

const truncateLongMessages = message => {
    let lines = message.split('\n');
    if (lines.length > 6) {
        lines = lines.slice(0, 5).concat(
            ['  ... snip ...'],
            lines.slice(-1)
        );
    }
    return lines.join('\n');
}

const formatLintResultsAsDefault = lintResults => {
    let output = '';
    lintResults.forEach(result => {
        const { rule, error, pointer } = result;

        output += `
${colors.yellow + pointer} ${colors.cyan} R: ${rule.name} ${colors.white} D: ${rule.description}
${colors.reset + truncateLongMessages(error.message)}

More information: ${rule.url}#${rule.name}
`;
    });

    return output;
}


const formatLintResults = (lintResults, format, specFile) => {
    if (format === 'sarif') {
        return formatLintResultsAsSarif(lintResults, specFile);
    }
    else {
        return formatLintResultsAsDefault(lintResults);
    }
}

const formatLintResultsAsSarif = (lintResults, specFile) => {
    const specFileDir = path.dirname(specFile)
    const specFileName = path.basename(specFile)
    const specFileDirFileUrl = url.pathToFileURL(specFileDir)
    const specFileDirFileUrlString = specFileDirFileUrl.toString() + '/'
    const templateFile = path.resolve(__dirname, 'templates/sarif_template.json');
    const template = fs.readFileSync(templateFile);
    let sarif = JSON.parse(template);
    sarif['runs'][0]['originalUriBaseIds']['ROOTPATH']['uri'] = specFileDirFileUrlString;
    sarif['runs'][0]['tool']['driver']['rules']  = [];
    sarif['runs'][0]['results'] = [];

    lintResults.forEach(result => {
        const { rule, error, pointer } = result;
        const ruleExists =  sarif['runs'][0]['tool']['driver']['rules'].some(it => it.id === rule.name);
        if (!ruleExists){
            var newRule = { 'id' : rule.name};
            newRule['shortDescription'] = { 'text' :  rule.description };
            newRule['helpUri'] = rule.url + "#" + rule.name;
            sarif['runs'][0]['tool']['driver']['rules'].push(newRule);
        }
        const ruleIndex = sarif['runs'][0]['tool']['driver']['rules'].length - 1;
        var result = {
            'ruleId' : rule.name,
            'ruleIndex' : ruleIndex,
            'message' : { 'text' : result.dataPath + ': ' + result.message },
            'locations' : [{ 'physicalLocation' : { 'artifactLocation' : { 'uri' : specFileName, 'uriBaseId' : 'ROOTPATH' } } }],
        };
        sarif['runs'][0]['results'].push(result);
    });
    
    return JSON.stringify(sarif);
}

const command = async (specFile, cmd) => {
    config.init(cmd);
    const jsonSchema = config.get('jsonSchema');
    const verbose = config.get('quiet') ? 0 : config.get('verbose', 1);
    const rulesets = config.get('lint:rules', []);
    const skip = config.get('lint:skip', []);
    const format = config.get('lint:format');

    rules.init({
        skip
    });
    await loader.loadRulesets(rulesets, { verbose });
    linter.applyRules(rules.getRules());

    const spec = await loader.readOrError(
        specFile,
        buildLoaderOptions(jsonSchema, verbose)
    );

    return new Promise((resolve, reject) => {
        validator.validate(spec, buildValidatorOptions(skip, verbose), (err, _options) => {
            const { context, warnings, valid } = _options || err.options;

            if (err && valid === false) {
                console.error(colors.red + 'Specification schema is invalid.' + colors.reset);
                if (err.name === 'AssertionError') {
                    console.error(formatSchemaError(err, context));
                }

                for (let linterResult of err.options.linterResults()) {
                    console.error(formatSchemaError(linterResult, context));
                }
                return reject();
            }

            if (warnings.length) {
                console.error(colors.red + 'Specification contains lint errors: ' + warnings.length + colors.reset);
                console.warn(formatLintResults(warnings, format, specFile))
                return reject();
            }

            if (!cmd.quiet) {
                console.log(colors.green + 'Specification is valid, with 0 lint errors' + colors.reset)
            }

            return resolve();
        });
    });
};

const buildLoaderOptions = (jsonSchema, verbose) => {
    const options = {
        filters: [],
        resolve: true,
        verbose,
    };

    if (jsonSchema) {
        options.filters.push(fromJsonSchema);
    }

    return options;
}

const buildValidatorOptions = (skip, verbose) => {
    return {
        skip,
        lint: true,
        linter: linter.lint,
        linterResults: linter.getResults,
        prettify: true,
        verbose,
    };
}

module.exports = { command };
