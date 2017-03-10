'use strict';

var crypto = require('crypto');
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

function resolve(root,pointer) {
	// TODO to be extended to resolve external references
	// use yield to wrap node-fetch for url refs ?
	return jptr.jptr(root,pointer);
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

module.exports = {

	clone : clone,
	uniqueOnly : uniqueOnly,
	recurse : recurse,
    sha256 : sha256,
	forceFailure : forceFailure,
	getVersion : getVersion,
	resolve : resolve,
	parameterTypeProperties : parameterTypeProperties

};
