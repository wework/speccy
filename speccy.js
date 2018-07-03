#!/usr/bin/env node

// @ts-check

'use strict';

process.env["NODE_CONFIG_DIR"] = "./.speccy";
process.env["SUPPRESS_NO_CONFIG_WARNING"] = true;

const config = require('config');
const program = require('commander');
const { version } = require('./package.json');
const lint = require('./lint.js');
const resolve = require('./resolve.js');
const serve = require('./serve.js');

function collect(val, item) {
  item.push(val);
  return item;
}

function getConfig(key, default) {
  if (config.has(key)) {
    return config.get(key);
  }
  return default;
}

function addtionalValues(list, default) {
  if (config.has(list)) {
    let result = [].concat(default, list);
    return result;
  }
}

program
    .version(version)
    .usage('<command>');

program
    .command('lint <file-or-url>')
    .description('ensure specs are not just valid OpenAPI, but lint against specified rules')
    .option('-q, --quiet', 'reduce verbosity')
    .option('-r, --rules [ruleFile]', 'provide multiple rules files', additionalValues(lint.rules, collect))
    .option('-s, --skip [ruleName]', 'provide multiple rules to skip', additionalValues(lint.skip, collect))
    .option('-j, --json-schema', 'treat $ref like JSON Schema and convert to OpenAPI Schema Objects')
    .option('-v, --verbose', 'increase verbosity', 2)
    .action(lint.command);

program
    .command('resolve <file-or-url>')
    .description('pull in external $ref files to create one mega-file')
    .option('-o, --output <file>', 'file to output to')
    .option('-q, --quiet', 'reduce verbosity', getConfig('resolve.quiet', false))
    .option('-j, --json-schema', 'treat $ref like JSON Schema and convert to OpenAPI Schema Objects')
    .option('-v, --verbose', 'increase verbosity', 2)
    .action(resolve.command);

program
    .command('serve <file-or-url>')
    .description('view specifications in beautiful human readable documentation')
    .option('-p, --port [value]', 'port on which the server will listen', getConfig('serve.port', 5000))
    .option('-q, --quiet', 'reduce verbosity', getConfig('serve.quiet', false))
    .option('-j, --json-schema', 'treat $ref like JSON Schema and convert to OpenAPI Schema Objects')
    .option('-v, --verbose', 'increase verbosity', 2)
    // TODO .option('-w, --watch', 'reloading browser on spec file changes')
    .action(serve.command);

program.parse(process.argv);

if (!program.args.length) program.help();
