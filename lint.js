#!/usr/bin/env node

'use strict'

const config = require('./lib/config.js');
const loader = require('./lib/loader.js');
const linter = require('./lib/linter.js');
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

  if (err.name === 'AssertionError') {
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

const formatLintResults = lintResults => {
    let output = '';
    lintResults.forEach(result => {
        const { rule, error, pointer } = result;

        output += `
${colors.yellow + pointer} ${colors.cyan} R: ${rule.name} ${colors.white} D: ${rule.description}
${colors.reset + truncateLongMessages(error.message)}

More information: https://speccy.io/rules/#${rule.name}
`;
    });

    return output;
}

const command = async (specFile, cmd) => {
    config.init(cmd);
    const jsonSchema = config.get('jsonSchema');
    const verbose = config.get('quiet') ? 0 : (config.get('verbose') ? 2 : 1);
    const rulesFiles = config.get('lint:rules');
    const skip = config.get('lint:skip');

    linter.init();
    await loader.loadRuleFiles(rulesFiles, { verbose });

    const spec = await loader.readOrError(
        specFile,
        buildLoaderOptions(jsonSchema, verbose),
    );

    validator.validate(spec, buildValidatorOptions(skip, verbose), (err, _options) => {
        const { context, lintResults } = _options;

        if (err) {
            console.error(colors.red + 'Specification schema is invalid.' + colors.reset);
            console.error(formatSchemaError(err, context));
            process.exit(1);
        }

        if (lintResults.length) {
            console.error(colors.red + 'Specification contains lint errors: ' + lintResults.length + colors.reset);
            console.warn(formatLintResults(lintResults))
            process.exit(1);
        }

        if (!cmd.quiet) {
          console.log(colors.green + 'Specification is valid, with 0 lint errors' + colors.reset)
        }
        process.exit(0);
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
        prettify: true,
        verbose,
    };
}

module.exports = { command };
