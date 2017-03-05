'use strict';

var fs = require('fs');
var path = require('path');
var rr = require('recursive-readdir');
var yaml = require('js-yaml');
var should = require('should');

var common = require('./common.js');
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

function expect(obj){
	return obj.should;
}

function checkParam(param){
	param.should.not.have.property('items');
	param.should.not.have.property('collectionFormat');
	if (param.type) param.type.should.not.be.exactly('file');
	if (param.in) {
		param.in.should.not.be.exactly('body');
		param.in.should.not.be.exactly('formData');
	}
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

			result.should.not.have.key('swagger');
			result.should.not.have.key('definitions');
			result.should.not.have.key('parameters');
			result.should.not.have.key('responses');
			result.should.not.have.key('securityDefinitions');
			result.should.not.have.key('produces');
			result.should.not.have.key('consumes');

			result.openapi.startsWith('3.0.').should.be.ok();

			// TODO validate with ajv 

			common.recurse(result,{},function(obj,key,parent){
				if ((key === '$ref') && (typeof obj[key] === 'string')) {
					should(obj[key].indexOf('#/definitions/')).be.exactly(-1);
				}
			});

			if (result.components.parameters) {
				for (var p in result.components.parameters) {
					checkParam(result.components.parameters[p]);
				}
			}
			for (var p in result.paths) {
				var pathItem = result.paths[p];
				if (pathItem.parameters) {
					for (var param of pathItem.parameters) {
						checkParam(param);
					}
				}
				for (var o in pathItem) {
					var op = pathItem[o];
					if (op.parameters) {
						for (var param of op.parameters) {
							checkParam(param);
						}
					}
				}
			}

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
