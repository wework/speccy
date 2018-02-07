#!/usr/bin/env node

// @ts-check
'use strict';

const program = require('commander');
const { version } = require('./package.json');
const lint = require('./lint.js');
const resolve = require('./resolve.js');

function collect(val, item) {
  item.push(val);
  return item;
}

program
  .version(version)
  .usage('<command>')

program
  .command('lint <file-or-url>')
  .option('-r, --rules [ruleFile]', 'Provide multiple rules files', collect, [])
  .action(lint.command);

program
  .command('resolve <file-or-url>')
  .option('-o, --output <file>', 'file to output to', 'resolved.yaml')
  .option('-q, --quiet', 'reduce verbosity')
  .option('-v, --verbose', 'increase verbosity', 2)
  .action(resolve.command);

program.parse(process.argv)

// Show help if nothing else is going on
if (!program.args.length) program.help();
