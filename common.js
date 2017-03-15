'use strict';

var crypto = require('crypto');
var util = require('util');

var jptr = require('jgexml/jpath.js');

function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function uniqueOnly(value, index, self) {
    return self.indexOf(value) === index;
}

function sha256(s) {
	var shasum = crypto.createHash('sha256');
	shasum.update(s);
	return shasum.digest('hex');
}

String.prototype.toCamelCase = function camelize() {
    return this.toLowerCase().replace(/[-_ \/\.](.)/g, function(match, group1) {
        return group1.toUpperCase();
    });
}

function forceFailure(openapi,message) {
	openapi.openapi = 'error';
	openapi["x-s2o-error"] = message;
}

function recurse(object,parent,callback) {
	for (var key in object) {
		callback(object,key,parent);
		if (typeof object[key] == 'object') {
			recurse(object[key],object,callback);
		}
	}
}

function getVersion() {
	return require('./package.json').version;
}

function* resolve(root,pointer,callback) {
	// TODO to be extended to resolve external references
	// use yield to wrap node-fetch for url refs ?
	var result = yield jptr.jptr(root,pointer);
	callback(null,result);
	return result;
}

function resolveSync(root,pointer) {
	var obj = false;
	var r = resolve(root,pointer,function(err,data){
		obj = data;
	});
	var result = r.next();
    while (!result.done) {
		result = r.next(result.value);
    }
	return obj; // just in case
}

const parameterTypeProperties = [
	'format',
	'minimum',
	'maximum',
	'exclusiveMinimum',
	'exclusiveMaximum',
	'minLength',
	'maxLength',
	'multipleOf',
	'minItems',
	'maxItems',
	'uniqueItems',
	'minProperties',
	'maxProperties',
	'additionalProperties',
	'pattern',
	'enum',
	'default'
];

const httpVerbs = [
	'get',
	'post',
	'put',
	'delete',
	'patch',
	'head',
	'options',
	'trace'
];

function sanitise(s) {
    return s.replace(/[^A-Za-z0-9_\-\.\\]+|\s+/gm, '_');
}

module.exports = {

	clone : clone,
	uniqueOnly : uniqueOnly,
	recurse : recurse,
    sha256 : sha256,
	forceFailure : forceFailure,
	getVersion : getVersion,
	resolve : resolve,
	resolveSync : resolveSync,
	parameterTypeProperties : parameterTypeProperties,
	httpVerbs : httpVerbs,
	sanitise : sanitise

};
