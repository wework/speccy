#!/usr/bin/env node

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

var pathspec = argv._.length>0 ? argv._ : ['../openapi-directory/APIs/'];

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
			try {
				src = JSON.parse(srcStr);
			}
			catch (ex) {}
		}
		if (!src || (!src.swagger && !src.openapi)) {
			return true; // skip it
		}

		var url = '';
		if (src.info && (src.info["x-origin"]) && (src.info["x-origin"].format)) {
			delete src.info["x-origin"].format; // contaminates format list below
			if (src.info['x-origin'].url) url = src.info['x-origin'].url;
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
						extensions[key].lastUrl = url;
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
						formats[fmt].lastUrl = url;
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
for (var pathEntry of pathspec) {
	pathEntry = path.resolve(pathEntry);
	rr(pathEntry, function (err, files) {
		for (var i in files) {
			if (!check(files[i])) {
				failures.push(files[i]);
			}
		}
	});
}

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

	var extStr = 'key\tdefinitions\ttype\tinstances\texample\n';
	for (var entry of ext) {
		var example = entry.lastSpec;
		if (entry.lastUrl) {
			example = entry.lastUrl;
		}
		extStr += entry.key+'\t'+entry.specs+'\t'+entry.type+'\t'+entry.count+'\t'+example+'\n';
	}
	fs.writeFileSync('extensions.tsv',extStr,'utf8');

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

	var formatStr = 'format\tdefinitions\tinstances\texample\n';
	for (var format of fmt) {
		var example = format.lastSpec;
		if (format.lastUrl) {
			example = entry.lastUrl;
		}
		formatStr += format.key+'\t'+format.specs+'\t'+format.count+'\t'+example+'\n';
	}
	fs.writeFileSync('formats.tsv',formatStr,'utf8');

	if (failures.length>0) {
		failures.sort();
		console.log(red);
		for (var f in failures) {
			console.log(failures[f]);
		}
	}
	console.log(normal);
	process.exitCode = ((fail === 0) && (pass > 0)) ? 0 : 1;
});
