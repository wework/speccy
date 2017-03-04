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

var pathspec = argv._.length>0 ? argv._[0] : '../openapi-directory/APIs/';

var options = argv;

function check(file) {
	var result = false;
	var components = file.split(path.sep);

	if ((components[components.length-1] == 'swagger.yaml') || (components[components.length-1] == 'swagger.json')) {
		console.log(normal+file);

		var srcStr = fs.readFileSync(path.resolve(file),'utf8');
		var src;
		if (components[components.length-1] == 'swagger.yaml') {
			src = yaml.safeLoad(srcStr);
		}
		else {
			src = JSON.parse(srcStr);
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
