#!/usr/bin/env node

'use strict'

const loader = require('./lib/loader.js');
const linter = require('./lib/linter.js');
const validator = require('./lib/validate.js');

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
  const message = err.message;
  let output;

  output = `
${colors.yellow + pointer}
${colors.reset + message}
`;

  if (err.stack && err.name !== 'AssertionError') {
      output += colors.red + err.stack + colors.reset;
  }
  return output;
}

const formatLintResults = lintResults => {
    let output = '';
    lintResults.forEach(result => {
        const { rule, error, pointer } = result;

        output += `
${colors.yellow + pointer} ${colors.cyan} R: ${rule.name} ${colors.white} D: ${rule.description}
${colors.reset + error.message}
`;
    });

    return output;
}

const readOrError = file => {
    try {
        return loader.loadSpec(file, { resolve: true });
    }
    catch (error) {
        if (error.name == 'OpenError') {
            console.error('Could not open file: ' + error.message);
        }
        else if (error.name == 'ReadError') {
            console.error('Could not read YAML/JSON from file: ' + error.message);
        }
        else {
            console.error(error);
        }
        process.exit(1);
    }
}

const command = async (file, cmd) => {
  const spec = await readOrError(file);
  const options = { openapi: spec };

  linter.loadRules(cmd.rules, cmd.skip);

  validator.validate(options.openapi, options, (err, options) => {
      if (err) {
          console.error(colors.red + 'Specification schema is invalid.' + colors.reset);
          const output = formatSchemaError(err, options.context);
          console.error(output);
          process.exit(1);
      }

      const lintResults = options.lintResults;
      if (lintResults.length) {
          console.error(colors.red + 'Specification contains lint errors: ' + lintResults.length + colors.reset);
          const output = formatLintResults(lintResults);
          console.warn(output)
          process.exit(1);
      }

      console.log(colors.green + 'Specification is valid, with 0 lint errors' + colors.reset)
      process.exit(0);
  });
};

module.exports = { command }
