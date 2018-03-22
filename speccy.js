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
    .option('-q, --quiet', 'reduce verbosity')
    .option('-r, --rules [ruleFile]', 'Provide multiple rules files', collect, [])
    .option('-s, --skip [ruleName]', 'Provide multiple rules to skip', collect, [])
    .option('-v, --verbose', 'increase verbosity', 2)
    .action(lint.command);

program
    .command('resolve <file-or-url>')
    .option('-o, --output <file>', 'file to output to', 'resolved.yaml')
    .option('-q, --quiet', 'reduce verbosity')
    .option('-v, --verbose', 'increase verbosity', 2)
    .action(resolve.command);

program
    .command('serve <file-or-url>')
    .description('View specifications in beautiful human readable documentation')
    .option('-p, --port [value]', 'port on which the server will listen', 5000)
    .option('-q, --quiet', 'reduce verbosity')
    .option('-v, --verbose', 'increase verbosity', 2)
    .option('-w, --watch', 'reloading browser on spec file changes')
    .action(serve.command);

program.parse(process.argv,function(){
    // Show help if nothing else is going on
    if (!program.args.length) program.help();
});

