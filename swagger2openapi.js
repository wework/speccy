#!/usr/bin/env node

'use strict';

var fs = require('fs');

var yaml = require('js-yaml');
var converter = require('./index.js');

var argv = require('yargs')
	.boolean('debug')
	.alias('d','debug')
	.describe('enable debug mode, adds specification-extensions')
    .help('help')
    .alias('h','help')
    .string('outfile')
    .alias('o','outfile')
    .describe('outfile', 'the output file to write to')
    .boolean('yaml')
    .alias('y','yaml')
    .describe('yaml', 'read and write YAML, default JSON')
    .require(1)
    .strict()
    .argv;

var s = fs.readFileSync(argv._[0],'utf8');
var swagger;
if (argv.yaml) {
    swagger = yaml.safeLoad(s);
}
else {
    swagger = JSON.parse(s);
}

var openapi = converter.convert(swagger, argv);

if (argv.outfile && argv.outfile.indexOf('.json') > 0) {
	argv.yaml = false;
}

if (argv.yaml) {
    s = yaml.safeDump(openapi);
}
else {
    s = JSON.stringify(openapi, null, 2);
}

if (argv.outfile) {
    fs.writeFileSync(argv.outfile, s, 'utf8');
}
else {
    console.log(s);
}
