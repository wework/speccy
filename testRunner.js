'use strict';

var fs = require('fs');
var path = require('path');
var rr = require('recursive-readdir');
var yaml = require('js-yaml');

var swagger2openapi = require('./index.js');
var validator = require('./validate.js');

var argv = require('yargs')
	.usage('testRunner [options] [{path-to-specs}]')
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

var pathspec = argv._.length>0 ? argv._[0] : '../openapi-directory/APIs/';

var options = argv;

function check(file,force) {
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
			var resultStr = JSON.stringify(result).split('is undefined').join('x');
			resultStr = resultStr.split('be undefined').join('x');
			resultStr = resultStr.split('If undefined').join('x');
			resultStr = resultStr.split('field undefined').join('x');
			resultStr = resultStr.split('undefined in which').join('x');
			resultStr = resultStr.split('undefined how many').join('x');
			resultStr = resultStr.split('":"undefined"').join('x'); // trello 'default's

			validator.validate(result);

			if ((resultStr != '{}') && (resultStr.indexOf('undefined')<0)) {
		    	console.log(green+'  %s %s',src.info.title,src.info.version);
		    	console.log('  %s',src.swagger ? src.host : src.servers[0].url);
				result = true;
			}
			else {
				result = false;
			}
		}
		catch (ex) {
			console.log(ex.message);
			result = false;
		}
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

process.exitCode = 1;
pathspec = path.resolve(pathspec);
var stats = fs.statSync(pathspec);
if (stats.isFile()) {
	if (!check(pathspec,true)) {
		failures.push(pathspec);
	}
}
else {
	rr(pathspec, function (err, files) {
		for (var i in files) {
			if (!check(files[i])) {
				failures.push(files[i]);
			}
		}
	});
}

process.on('exit', function(code) {
	if (failures.length>0) {
		failures.sort();
		console.log(red);
		for (var f in failures) {
			console.log(failures[f]);
		}
	}
	console.log(normal);
	console.log('Tests: %s passing, %s failing', pass, fail);
	process.exitCode = ((fail === 0) && (pass > 0)) ? 0 : 1;
});
