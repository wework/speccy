// @ts-check
'use strict';

var fs = require('fs');
var path = require('path');
var util = require('util');
var readfiles = require('node-readfiles');
var yaml = require('js-yaml');

var common = require('./common.js');
var swagger2openapi = require('./index.js');
var validator = require('./validate.js');

var argv = require('yargs')
	.usage('testRunner [options] [{path-to-specs}...]')
	.string('encoding')
	.alias('e','encoding')
	.default('encoding','utf8')
	.describe('encoding','encoding for input/output files')
	.string('fail')
	.describe('fail','path to specs expected to fail')
	.alias('f','fail')
	.boolean('laxurls')
	.alias('l','laxurls')
	.describe('laxurls','lax checking of empty urls')
	.boolean('nopatch')
	.alias('n','nopatch')
	.describe('nopatch','do not patch minor errors in the source definition')
	.boolean('quiet')
	.alias('q','quiet')
	.describe('quiet','do not show test passes on console, for CI')
	.boolean('resolve')
	.alias('r','resolve')
	.describe('resolve','resolve external references')
	.boolean('stop')
	.alias('s','stop')
	.describe('stop','stop on first error')
	.count('verbose')
	.alias('v','verbose')
	.describe('verbose','increase verbosity')
	.boolean('whatwg')
	.alias('w','whatwg')
	.describe('whatwg','enable WHATWG URL parsing')
	.help('h')
    .alias('h', 'help')
	.strict()
	.version(function() {
		return require('../package.json').version;
	})
	.argv;

var red = process.env.NODE_DISABLE_COLORS ? '' : '\x1b[31m';
var green = process.env.NODE_DISABLE_COLORS ? '' : '\x1b[32m';
var yellow = process.env.NODE_DISABLE_COLORS ? '' : '\x1b[33;1m';
var normal = process.env.NODE_DISABLE_COLORS ? '' : '\x1b[0m';

var pass = 0;
var fail = 0;
var failures = [];
var warnings = [];

var genStack = [];

var options = argv;
options.patch = !argv.nopatch;

function handleResult(err, options) {
	var result = false;
	if (err) {
		options = err.options||{file:'unknown',src:{info:{version:'',title:''}}};
		console.log(normal+options.file);
		console.log(red+'Converter: '+err.message);
	}
	else {
		result = options.openapi;
	}
	var resultStr = JSON.stringify(result);

	if (typeof result !== 'boolean') try {
		var src = options.original;
		resultStr = yaml.safeDump(result); // should be representable safely in yaml
		resultStr.should.not.be.exactly('{}');

		result = validator.validateSync(result,options);

		for (var warning of options.warnings) {
			warnings.push(options.file+' '+warning);
		}

		if (!argv.quiet) {
			console.log(normal+options.file);
			var colour = ((options.expectFailure ? !result : result) ? green : red);
			console.log(colour+'  %s %s',src.info.title,src.info.version);
			console.log('  %s',src.swagger ? (src.host ? src.host : 'relative') : (src.servers && src.servers.length ? src.servers[0].url : 'relative'));
		}
	}
	catch (ex) {
		console.log(normal+options.file);
		console.log(red+options.context.pop()+'\n'+ex.message);
		result = !!options.expectFailure;
		if (ex.stack && ex.name !== 'AssertionError') {
			console.log(ex.stack);
		}
	}
	if (result) {
		pass++;
	}
	else {
		fail++;
		if (options.file != 'unknown') failures.push(options.file);
		if (argv.stop) process.exit(1);
	}
	genStackNext();
}

function genStackNext() {
	if (!genStack.length) return false;
	var gen = genStack.pop();
	gen.next();
	return true;
}

function* check(file,force,expectFailure) {
	var result = false;
	options.context = [];
	options.expectFailure = expectFailure;
	options.file = file;
	var components = file.split(path.sep);
	var name = components[components.length-1];

	if ((name.indexOf('.yaml')>=0) || (name.indexOf('.json')>=0) || force) {

		var srcStr = fs.readFileSync(path.resolve(file),options.encoding);
		var src;
		try {
			src = JSON.parse(srcStr);
		}
		catch (ex) {
			try {
				src = yaml.safeLoad(srcStr,{schema:yaml.JSON_SCHEMA,json:true});
			}
			catch (ex) {
				var warning = 'Could not parse file '+file+'\n'+ex.message;
				console.log(red+warning);
				warnings.push(warning);
			}
		}

		if (!src || ((!src.swagger && !src.openapi))) {
			genStackNext();
			return true;
		}

		options.original = src;
		options.source = file;

		try {
			swagger2openapi.convertObj(src, common.clone(options), handleResult);
		}
		catch (ex) {
			console.log(red+'Converter threw an error: '+ex.message);
			warnings.push('Converter failed '+options.source);
			genStackNext();
			result = false;
		}

	}
	else {
		genStackNext();
		result = true;
	}
	return result;
}

function processPathSpec(pathspec,expectFailure) {
	pathspec = path.resolve(pathspec);
	var stats = fs.statSync(pathspec);
	if (stats.isFile()) {
		genStack.push(check(pathspec,true,expectFailure));
		genStackNext();
	}
	else {
		readfiles(pathspec, {readContents: false, filenameFormat: readfiles.FULL_PATH}, function (err) {
			if (err) console.log(util.inspect(err));
		})
		.then(files => {
			files = files.sort(function(a,b){
				if (a<b) return +1;
				if (a>b) return -1;
				return 0;
			});
			for (var file of files) {
				genStack.push(check(file,false,expectFailure));
			}
			genStackNext();
		})
		.catch(err => {
			console.log(util.inspect(err));
		});
	}
}

process.exitCode = 1;
console.log('Gathering...');
if ((!argv._.length) && (!argv.fail)) {
	argv._.push('../openapi-directory/APIs/');
}
for (let pathspec of argv._) {
	processPathSpec(pathspec,false);
}
if (argv.fail) {
	if (!Array.isArray(argv.fail)) argv.fail = [argv.fail];
	for (let pathspec of argv.fail) {
		processPathSpec(pathspec,true);
	}
}

process.on('exit', function() {
	if (warnings.length) {
		warnings.sort();
		console.log(normal+'\nWarnings:'+yellow);
		for (var w in warnings) {
			console.log(warnings[w]);
		}
	}
	if (failures.length) {
		failures.sort();
		console.log(normal+'\nFailures:'+red);
		for (var f in failures) {
			console.log(failures[f]);
		}
	}
	console.log(normal);
	console.log('Tests: %s passing, %s failing, %s warnings', pass, fail, warnings.length);
	process.exitCode = ((fail === 0) && (pass > 0)) ? 0 : 1;
});
