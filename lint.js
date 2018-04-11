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
  let output = `
${colors.yellow + pointer}
`;

  if (err.name === 'AssertionError') {
      output += colors.reset + truncateLongMessages(err.message);
  }
  else if (err instanceof validator.JSONSchemaError) {
      output += colors.reset + readableJsonSchemaMessages(err).join('\n');
  }
  else {
      output += colors.red + err.stack;
  }
  return output;
}

function readableJsonSchemaMessages(err) {
    return err.errors.map(error => {
        const { data, dataPath, params } = error;
        if (params.missingProperty) {
            return `${dataPath} is missing property: ${params.missingProperty}`;
        }
        if (params.additionalProperty) {
            return `${dataPath} has an unexpected additional property: ${params.additionalProperty}`;
        }
        if (params.format) {
            return `${dataPath} has an unexpected format. It should match ${params.format}. Value is: ${data}`;
        }
        return `${dataPath} ${message}`;
    });
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
`;
    });

    return output;
}

const command = async (file, cmd) => {
    const verbose = cmd.quiet ? 1 : cmd.verbose;

    const options = {
        jsonSchema: cmd.jsonSchema === true,
        resolve: true,
        verbose,
    }

    const spec = await loader.readOrError(file, options);
    const rules = loader.loadRules(cmd.rules, cmd.skip);

    if (verbose > 1) {
        console.log('Found ' + rules.length + ' rules: ' + rules.map(x => x.name))
    };

    // Prep the linter with these rules
    linter.setRules(rules);

    validator.validate(spec, { verbose }, (err, _options) => {
        const { context, lintResults } = _options;

        if (err) {
            console.error(colors.red + 'Specification schema is invalid.' + colors.reset);
            const output = formatSchemaError(err, context);
            console.error(output);
            process.exit(1);
        }

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
