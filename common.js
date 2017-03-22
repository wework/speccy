'use strict';

var crypto = require('crypto');
var fs = require('fs');
var path = require('path');
var util = require('util');
var url = require('url');

var fetch = require('node-fetch');
var yaml = require('js-yaml');
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
	throw(new Error(message));
}

function recurse(object,parent,pkey,path,callback) {
	if (!path) {
		path = '#';
	}
	for (var key in object) {
		var escKey = '/'+jptr.jpescape(key);
		callback(object,key,parent,pkey,path+escKey);
		if (typeof object[key] == 'object') {
			recurse(object[key],object,key,path+escKey,callback);
		}
	}
}

function getVersion() {
	return require('./package.json').version;
}

fs.readFileAsync = function(filename, encoding) {
    return new Promise(function(resolve, reject) {
        fs.readFile(filename, encoding, function(err, data){
            if (err)
                reject(err);
            else
                resolve(data);
        });
    });
};

function resolveExternal(root,pointer,options,callback) {
	var u = url.parse(options.source);
	var base = options.source.split('/');
	base.pop(); // drop the actual filename
	base = base.join('/');
	if (options.verbose) console.log((u.protocol ? 'GET ' : 'file://') + base+'/'+pointer);
	if (u.protocol) {
		return fetch(base+'/'+pointer)
		.then(function(res){
			return res.text();
		})
		.then(function(data){
			try {
				data = yaml.safeLoad(data);
			}
			catch (ex) {}
			callback(data);
			return data;
		});
	}
	else {
		return fs.readFileAsync(base+'/'+pointer,options.encoding||'utf8');
	}
}

function resolveInternal(root,pointer,options) {
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
    return s.replace(/[^A-Za-z0-9_\-\.]+|\s+/gm, '_');
}

module.exports = {

	clone : clone,
	uniqueOnly : uniqueOnly,
	recurse : recurse,
    sha256 : sha256,
	forceFailure : forceFailure, // TODO can be removed in v2.0.0
	getVersion : getVersion,
	resolveExternal : resolveExternal,
	resolveInternal : resolveInternal,
	parameterTypeProperties : parameterTypeProperties,
	httpVerbs : httpVerbs,
	sanitise : sanitise

};
