'use strict';

var fs = require('fs');
var path = require('path');
var rr = require('recursive-readdir');
var yaml = require('js-yaml');
var swagger2openapi = require('./index.js');

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

function checkParam(param){
	if (param.items) return false;
	if (param.collectionFormat) return false;
	if (param.in == 'body') return false;
	if (param.in == 'formData') return false;
	return true;
}

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
	        result = swagger2openapi.convert(src, options);
			var resultStr = JSON.stringify(result,null,2).split('is undefined').join('x');
			resultStr = resultStr.split('be undefined').join('x');
			resultStr = resultStr.split('field undefined').join('x');
			resultStr = resultStr.split('undefined in which').join('x');
			resultStr = resultStr.split('undefined how many').join('x');
			resultStr = resultStr.split('": "undefined"').join('x'); // trello 'default's

			var sanity = true;
			if (!result.openapi.startsWith('3.0.')) sanity = false;
			if (result.swagger) sanity = false;
			if (result.definitions) sanity = false;
			if (result.parameters) sanity = false;
			if (result.responses) sanity = false;
			if (result.securityDefinitions) sanity = false;
			if (result.consumes) sanity = false;
			if (result.produces) sanity = false;

			// TODO validate with ajv 

			if (sanity) {
				swagger2openapi.recurse(result,{},function(obj,key,parent){
					if ((key === '$ref') && (typeof obj[key] === 'string')) {
						if (obj[key].indexOf('#/definitions/') == 0) {
							sanity = false;
						}
					}
				});
			}

			if (sanity && result.components.parameters) {
				for (var p in result.components.parameters) {
					sanity = checkParam(result.components.parameters[p]);
					if (!sanity) break;
				}
			}
			if (sanity) {
				for (var p in result.paths) {
					var pathItem = result.paths[p];
					if (pathItem.parameters) {
						for (var param of pathItem.parameters) {
							sanity = checkParam(param);
							if (!sanity) break;
						}
					}
					if (sanity) {
						for (var o in pathItem) {
							var op = pathItem[o];
							if (op.parameters) {
								for (var param of op.parameters) {
									sanity = checkParam(param);
									if (!sanity) break;
								}
							}
						}
					}
				}
			}

			if ((resultStr != '{}') && (resultStr.indexOf('undefined')<0) && sanity) {
		    	console.log(green+'  %s %s',src.info.title,src.info.version);
		    	console.log('  %s',src.host);
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
rr(pathspec, function (err, files) {
	for (var i in files) {
		if (!check(files[i])) {
			failures.push(files[i]);
		}
	}
});

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
