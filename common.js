'use strict';

var crypto = require('crypto');

function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function uniqueOnly(value, index, self) {
    return self.indexOf(value) === index;
}

function sha1(s) {
	var shasum = crypto.createHash('sha1');
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

module.exports = {

	clone : clone,
	uniqueOnly : uniqueOnly,
	recurse : recurse,
    sha1 : sha1,
	forceFailure : forceFailure

};
