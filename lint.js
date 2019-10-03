#!/usr/bin/env node

'use strict'

const config = require('./lib/config.js');
const loader = require('./lib/loader.js');
const linter = require('oas-linter');
const rules = require('./lib/rules.js');
const validator = require('oas-validator');
const fromJsonSchema = require('json-schema-to-openapi-schema');
const consoleOutputRenderer = require('./lib/output/console.js');

const getOutputRenderer = type => {
    return consoleOutputRenderer;
}

const command = async (specFile, cmd) => {
    config.init(cmd);    
    const jsonSchema = config.get('jsonSchema');
    const verbose = config.get('quiet') ? 0 : config.get('verbose', 1);
    const rulesets = config.get('lint:rules', []);
    const skip = config.get('lint:skip', []);
    const outputRenderer = getOutputRenderer(config.get('lint:output'));

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

            outputRenderer.render(err, warnings, valid, context, cmd.quiet);
            
            if (err && valid === false) {
                return reject();
            }

            if (warnings.length) {
                return reject();
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
