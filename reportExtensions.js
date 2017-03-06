'use strict';

var fs = require('fs');
var path = require('path');
var rr = require('recursive-readdir');
var yaml = require('js-yaml');
var common = require('./common.js');
var swagger2openapi = require('./index.js');

var argv = require('yargs')
	.usage('reportExtensions [options] [{path-to-specs}]')
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

var extensions = {};
var formats = {};

var pathspec = argv._.length>0 ? argv._[0] : '../openapi-directory/APIs/';

var options = argv;

function check(file) {
	var result = false;
	var components = file.split(path.sep);
	var filename = components[components.length-1];

	if ((filename.indexOf('.yaml')>=0) || (filename.indexOf('.json')>=0)) {
		console.log(normal+file);

		var srcStr = fs.readFileSync(path.resolve(file),'utf8');
		var src;
		if (filename.indexOf('.yaml')>=0) {
			src = yaml.safeLoad(srcStr);
		}
		else {
			src = JSON.parse(srcStr);
		}
		if (!src.swagger && !src.openapi) {
			return true; // skip it
		}

		if ((src.info["x-origin"]) && (src.info["x-origin"].format)) {
			delete src.info["x-origin"].format; // contaminates format list below
		}

		try {
			common.recurse(src,{},function(obj,key,parent){
				if (key.startsWith('x-')) {
					if (!extensions[key]) {
						extensions[key] = {};
						extensions[key].count = 0;
						extensions[key].specs = 0;
						extensions[key].lastSpec = '*';
						extensions[key].type = typeof obj[key];
					}
					extensions[key].count++;
					if (extensions[key].lastSpec != file) {
						extensions[key].specs++;
						extensions[key].lastSpec = file;
					}
					if (extensions[key].type != typeof obj[key]) {
						extensions[key].type = 'multiple';
					}
				}

				if ((key == 'format') && (typeof obj[key] == 'string')) {
					var fmt = obj[key];
					if (!formats[fmt]) {
						formats[fmt] = {};
						formats[fmt].count = 0;
						formats[fmt].specs = 0;
						formats[fmt].lastSpec = '*';
					}
					formats[fmt].count++;
					if (formats[fmt].lastSpec != file) {
						formats[fmt].specs++;
						formats[fmt].lastSpec = file;
					}
				}
			});
			result = true;
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
rr(pathspec, function (err, files) {
	for (var i in files) {
		if (!check(files[i])) {
			failures.push(files[i]);
		}
	}
});

process.on('exit', function(code) {

	var ext = [];
	for (var e in extensions) {
		extensions[e].key = e;
		ext.push(extensions[e]);
	}

	ext = ext.sort(function(a,b){
		if (a.specs < b.specs) return +1;
		if (a.specs > b.specs) return -1;
		if (a.key < b.key) return -1;
		if (a.key > b.key) return +1;
		if (a.count < b.count) return +1;
		if (a.count > b.count) return -1;
		return 0;
	});

	console.log();
	console.log('|key|specs|type|count|example|');
	console.log('|---|---|---|---|---|');
	for (var entry of ext) {
		console.log(entry.key+'|'+entry.specs+'|'+entry.type+'|'+entry.count+'|'+entry.lastSpec);
	}

	var fmt = [];
	for (var f in formats) {
		formats[f].key = f;
		fmt.push(formats[f]);
	}

	fmt = fmt.sort(function(a,b){
		if (a.specs < b.specs) return +1;
		if (a.specs > b.specs) return -1;
		if (a.key < b.key) return -1;
		if (a.key > b.key) return +1;
		if (a.count < b.count) return +1;
		if (a.count > b.count) return -1;
		return 0;
	});

	console.log();
	console.log('|format|specs|count|example|');
	console.log('|---|---|---|---|');

	for (var format of fmt) {
		console.log(format.key+'|'+format.specs+'|'+format.count+'|'+format.lastSpec);
	}

	if (failures.length>0) {
		failures.sort();
		console.log(red);
		for (var f in failures) {
			console.log(failures[f]);
		}
	}
	console.log(normal);
	//console.log('Specs: %s passing, %s failing', pass, fail);
	process.exitCode = ((fail === 0) && (pass > 0)) ? 0 : 1;
});
