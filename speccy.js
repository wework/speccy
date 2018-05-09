#!/usr/bin/env node

// @ts-check

'use strict';

const program = require('commander');
const { version } = require('./package.json');
const lint = require('./lint.js');
const resolve = require('./resolve.js');
const serve = require('./serve.js');

function collect(val, item) {
  item.push(val);
  return item;
}

program
    .version(version)
    .usage('<command>');

program
    .command('lint <file-or-url>')
    .description('ensure specs are not just valid OpenAPI, but lint against specified rules')
    .option('-o, --open-api-version [value]', 'provide OpenAPI specification version to use', 3)
    .option('-q, --quiet', 'reduce verbosity')
    .option('-r, --rules [ruleFile]', 'provide multiple rules files', collect, [])
    .option('-s, --skip [ruleName]', 'provide multiple rules to skip', collect, [])
    .option('-j, --json-schema', 'treat $ref like JSON Schema and convert to OpenAPI Schema Objects')
    .option('-v, --verbose', 'increase verbosity', 2)
    .action(lint.command);

program
    .command('resolve <file-or-url>')
    .description('pull in external $ref files to create one mega-file')
    .option('-o, --output <file>', 'file to output to')
    .option('-q, --quiet', 'reduce verbosity')
    .option('-j, --json-schema', 'treat $ref like JSON Schema and convert to OpenAPI Schema Objects')
    .option('-v, --verbose', 'increase verbosity', 2)
    .action(resolve.command);

program
    .command('serve <file-or-url>')
    .description('view specifications in beautiful human readable documentation')
    .option('-p, --port [value]', 'port on which the server will listen', 5000)
    .option('-q, --quiet', 'reduce verbosity')
    .option('-j, --json-schema', 'treat $ref like JSON Schema and convert to OpenAPI Schema Objects')
    .option('-v, --verbose', 'increase verbosity', 2)
    // TODO .option('-w, --watch', 'reloading browser on spec file changes')
    .action(serve.command);

program.parse(process.argv);

if (!program.args.length) program.help();
