#!/usr/bin/env node

// @ts-check
'use strict';

const program = require('commander');
const { version } = require('./package.json');
const lint = require('./lint.js')

function collect(val, item) {
  item.push(val);
  return item;
}

program
  .version(version)
  .usage('<command> [options] <file-or-url>')

program
  .command('lint <file-or-url>')
  .option('-r, --rules [ruleFile]', 'Provide multiple rules files', collect, [])
  .description('Ensure your OpenAPI files are valid and up to scratch')
  .action(lint.command);

program.parse(process.argv)
