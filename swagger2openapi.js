#!/usr/bin/env node

'use strict';

var fs = require('fs');
var url = require('url');

var yaml = require('js-yaml');
var converter = require('./index.js');

var argv = require('yargs')
	.boolean('components')
	.alias('c','components')
	.describe('components','output information to unresolve a definition')
	.boolean('debug')
	.alias('d','debug')
	.describe('debug','enable debug mode, adds specification-extensions')
	.string('encoding')
	.alias('e','encoding')
	.default('encoding','utf8')
	.describe('encoding','encoding for input/output files')
    .help('help')
    .alias('h','help')
    .string('outfile')
    .alias('o','outfile')
    .describe('outfile', 'the output file to write to')
	.boolean('patch')
	.alias('p','patch')
	.describe('patch','fix up small errors in the source definition')
	.boolean('resolve')
	.alias('r','resolve')
	.describe('resolve','resolve external references')
	.string('url')
	.describe('url','url of original spec, creates x-origin entry')
	.alias('u','url')
	.count('verbose')
	.alias('v','verbose')
	.describe('verbose','increase verbosity')
    .boolean('yaml')
    .alias('y','yaml')
    .describe('yaml', 'read and write YAML, default JSON')
    .require(1)
    .strict()
    .argv;

function processResult(err, options) {
	if (err) {
		console.log(err.message);
		return process.exitCode = 1;
	}
	if (options.yaml && options.outfile && options.outfile.indexOf('.json') > 0) {
        options.yaml = false;
	}
	if (!options.yaml && options.outfile && options.outfile.indexOf('.yaml') > 0) {
        options.yaml = true;
	}

	var s;
	if (options.yaml) {
   		s = options.debug ? yaml.dump(options.openapi) : yaml.safeDump(options.openapi);
	}
	else {
   		s = JSON.stringify(options.openapi, null, 2);
	}

	if (argv.outfile) {
  		fs.writeFileSync(options.outfile, s, options.encoding||'utf8');
	}
	else {
  		console.log(s);
	}

	if (argv.components) {
		console.log(JSON.stringify(options.externals,null,2));
	}
}

argv.source = argv._[0];
var u = url.parse(argv.source);
if (u.protocol) {
	converter.convertUrl(argv.source,argv,processResult);
}
else {
	argv.origin = argv.url;
	converter.convertFile(argv.source,argv,processResult);
}

