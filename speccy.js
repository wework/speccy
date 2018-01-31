#!/usr/bin/env node

// @ts-check
'use strict';

const program = require('commander');

const lint = require('./lint.js')

program
  .version('0.1.0')
  .usage('<command> [options] <file-or-url>')

program
  .command('lint <file-or-url>')
  .description('Ensure your OpenAPI files are valid and up to scratch')
  .action((file) => lint.command(file));

program.parse(process.argv)
