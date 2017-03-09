'use strict';

var fs = require('fs');
var path = require('path');
var rr = require('recursive-readdir');
var yaml = require('js-yaml');

var swagger2openapi = require('./index.js');
var validator = require('./validate.js');

var argv = require('yargs')
	.usage('testRunner [options] [{path-to-specs}...]')
	.string('fail')
	.describe('fail','path to specs expected to fail')
	.alias('f','fail')
	.count('verbose')
	.alias('v','verbose')
	.describe('verbose','Increase verbosity')
	.help('h')
    .alias('h', 'help')
	.strict()
	.version(function() {
		return require('../package.json').version;
	})
	.argv;

var red = process.env.NODE_DISABLE_COLORS ? '' : '\x1b[31m';
var green = process.env.NODE_DISABLE_COLORS ? '' : '\x1b[32m';
var normal = process.env.NODE_DISABLE_COLORS ? '' : '\x1b[0m';

var pass = 0;
var fail = 0;
var failures = [];

var options = argv;

function check(file,force,expectFailure) {
	var result = false;
	var components = file.split(path.sep);
	var name = components[components.length-1];

	if ((name.indexOf('.yaml')>=0) || (name.indexOf('.json')>=0) || force) {

		var srcStr = fs.readFileSync(path.resolve(file),'utf8');
		var src;
		try {
			if (name.indexOf('.yaml')>=0) {
				src = yaml.safeLoad(srcStr);
			}
			else {
				src = JSON.parse(srcStr);
			}
		}
		catch (ex) {}

		if (!src || ((!src.swagger && !src.openapi))) return true;
		console.log(normal+file);

		try {
	        result = swagger2openapi.convert(src, options);
			var resultStr = JSON.stringify(result);

			validator.validate(result,options);

			resultStr = yaml.safeDump(result); // should be representable safely in yaml
			resultStr.should.not.be.exactly('{}');

		  	console.log(green+'  %s %s',src.info.title,src.info.version);
			console.log('  %s',src.swagger ? (src.host ? src.host : 'relative') : (src.servers && src.servers.length ? src.servers[0].url : 'relative'));
			result = true;
		}
		catch (ex) {
			console.log(red+options.context.pop()+'\n'+ex.message);
			result = false;
		}
		if (expectFailure) result = !result;
		if (result) {
			pass++;
		}
		else {
			fail++;
		}
	}
	else {
		result = true;
	}
	return result;
}

function processPathSpec(pathspec,expectFailure) {
	pathspec = path.resolve(pathspec);
	var stats = fs.statSync(pathspec);
	if (stats.isFile()) {
		if (!check(pathspec,true,expectFaiure)) {
			failures.push(pathspec);
		}
	}
	else {
		rr(pathspec, function (err, files) {
			for (var i in files) {
				if (!check(files[i],false,expectFailure)) {
					failures.push(files[i]);
				}
			}
		});
	}
}

process.exitCode = 1;
if ((!argv._.length) && (!argv.fail)) {
	argv._.push('../openapi-directory/APIs/');
}
for (var pathspec of argv._) {
	processPathSpec(pathspec,false);
}
if (argv.fail) {
	if (!Array.isArray(argv.fail)) argv.fail = [argv.fail];
	for (var pathspec of argv.fail) {
		processPathSpec(pathspec,true);
	}
}

process.on('exit', function(code) {
	if (failures.length>0) {
		failures.sort();
		console.log(normal+'\nFailures:'+red);
		for (var f in failures) {
			console.log(failures[f]);
		}
	}
	console.log(normal);
	console.log('Tests: %s passing, %s failing', pass, fail);
	process.exitCode = ((fail === 0) && (pass > 0)) ? 0 : 1;
});
