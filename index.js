'use strict';

var crypto = require('crypto');

var jptr = require('jgexml/jpath.js');

// TODO split out into common, params, security etc

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

function deleteParameters(value, index, self) {
	return !value["x-s2o-delete"];
}

function recurse(object,parent,callback) {
	for (var key in object) {
		callback(object,key,parent);
		if (typeof object[key] == 'object') {
			recurse(object[key],object,callback);
		}
	}
}

function forceFailure(openapi,message) {
	openapi.openapi = 'error';
	openapi["x-s2o-error"] = message;
}

function processSecurityScheme(scheme) {
	if (scheme.type == 'oauth2') {
		if (scheme.flow == 'application') scheme.flow = 'clientCredentials';
		if (scheme.flow == 'accessCode') scheme.flow = 'authorizationCode';
	}
}

function processParameter(param,op,path,index,openapi) {
	var result = {};
	var singularRequestBody = true;

	if (param["$ref"]) {
		param["$ref"] = param["$ref"].replace('#/parameters/','#/components/parameters/');
		var ptr = param["$ref"].replace('#/components/parameters/','');
		var rbody = false;
		var target = openapi.components.parameters[ptr];
		if ((!target) || (target["x-s2o-delete"])) {
			// it's gone, chances are it's a requestBody now unless spec was broken
			// OR external ref - not supported yet
			param["x-s2o-delete"] = true;
			rbody = true;
		}

		// shared formData parameters from swagger or path level could be used in any combination. 
		// probably best is to make all op.requestBody's unique then hash them and pull out
		// any common ones afterwards // TODO

		if (rbody) {
			param = jptr.jptr(openapi,param["$ref"]);
		}
	}

	if (param.type || param.in) { // if it's a real parameter OR we've dereferenced it
		if (param.schema) {
			recurse(param.schema,{},function(obj,key,parent){
				if ((key == '$ref') && (typeof obj[key] === 'string')) {
					obj[key] = obj[key].replace('#/definitions/','#/components/schemas/');
				}
				if (key == 'x-anyOf') {
					obj.anyOf = obj[key];
					delete obj[key];
				}
				if (key == 'x-oneOf') {
					obj.oneOf = obj[key];
					delete obj[key];
				}
				if (key == 'x-not') {
					obj.not = obj[key];
					delete obj[key];
				}
			});
		}
		if (param.collectionFormat) {
			if (param.collectionFormat = 'csv') {
				param.style = 'form';
			}
			if (param.collectionFormat = 'ssv') {
				param.style = 'spaceDelimited';
			}
			if (param.collectionFormat = 'pipes') {
				param.style = 'pipeDelimeted';
			}
			delete param.collectionFormat;
		}
	}
	if (param.in == 'formData') {
		// convert to requestBody component
		singularRequestBody = false;
		result.content = {};
		result.content["application/x-www-form-urlencoded"] = {};
		if (param.schema) {
			result.content["application/x-www-form-urlencoded"].schema = param.schema;
		}
		else {
			result.content["application/x-www-form-urlencoded"].properties = {};
			result.content["application/x-www-form-urlencoded"].properties[param.name] = {};
			var target = result.content["application/x-www-form-urlencoded"].properties[param.name];
			target.description = param.description;
			target.type = param.type;
			target.required = param.required;
			target.default = param.default;
			target.format = param.format;
			target.minimum = param.minimum;
			target.maximum = param.maximum;
			target.exclusiveMinimum = param.exclusiveMinimum;
			target.exclusiveMaximum = param.exclusiveMaximum;
			target.minItems = param.minItems;
			target.maxItems = param.maxItems;
			target.uniqueItems = param.uniqueItems;
			target.pattern = param.pattern;
			target.enum = param.enum;
			target.multipleOf = param.multipleOf;
			target.minLength = param.minLength;
			target.maxLength = param.maxLength;
			target.properties = param.properties;
			target.minProperties = param.minProperties;
			target.maxProperties = param.maxProperties;
			target.additionalProperties = param.additionalProperties;
			target.allOf = param.allOf; // new are anyOf, oneOf, not
			if ((param.type == 'array') && (param.items)) {
				target.items = param.items;
			}
		}
	}
	if (param.type == 'file') {
		// convert to requestBody
		result.content = {};
		result.content["application/octet-stream"] = {};
		result.content["application/octet-stream"].schema = {};
		result.content["application/octet-stream"].schema.type = 'string';
		result.content["application/octet-stream"].schema.format = 'binary';
	}
	if (param.in == 'body') {
		result.content = {};
		var consumes = ((op && op.consumes)||[]).concat(openapi.consumes||[]);
		consumes = consumes.filter(uniqueOnly);

		if (consumes.length == 0) {
			consumes.push('application/json'); // default as per section xxx
		}

		for (var mimetype of consumes) {
			result.content[mimetype] = {};
			result.content[mimetype].description = param.description;
			result.content[mimetype].schema = param.schema||{};
		}
	}

	// TODO multipart/formData etc

	if (Object.keys(result).length > 0) {
		param["x-s2o-delete"] = true;
		// work out where to attach the requestBody
		if (op) {
			if (op.requestBody && singularRequestBody) {
				op.requestBody["x-s2o-overloaded"] = true;
				forceFailure(openapi,'Operation has >1 requestBodies');
			}
			else {
				op.requestBody = Object.assign({},op.requestBody);
				if ((op.requestBody.content && op.requestBody.content["application/x-www-form-urlencoded"]) 
					&& (result.content["application/x-www-form-urlencoded"])) {
					op.requestBody.content["application/x-www-form-urlencoded"].properties =
						Object.assign(op.requestBody.content["application/x-www-form-urlencoded"].properties,result.content["application/x-www-form-urlencoded"].properties);
				}
				else {
					op.requestBody = Object.assign(op.requestBody,result);
				}
			}
		}
		else if (path) {
			var uniqueName = index ? index.toCamelCase()+'RequestBodyBase' : param.name;
			if (!index) {
				forceFailure(openapi,'Named requestBody needs name');
			}
			if (param.in == 'formData') {
				result["x-s2o-partial"] = true;
			}
			openapi.components.requestBodies[uniqueName] = result;
		}
		else {
			var uniqueName = index ? index : param.name;
			if (!index) {
				forceFailure(openapi,'Named requestBody needs name');
			}
			if (param.in == 'formData') {
				result["x-s2o-partial"] = true;
			}
			openapi.components.requestBodies[uniqueName] = result;
		}
	}

	return result;
}

function convert(swagger, options) {
	var requestBodyCache = {};

	var openapi = {};
	openapi.openapi = '3.0.0-RC0'; // semver
	openapi.servers = [];
	// we want the new and existing properties to appear in a sensible order
    openapi = Object.assign(openapi,clone(swagger));
    delete openapi.swagger;

	if ((!swagger.swagger) || (swagger.swagger != "2.0")) return {}; // handle 1.2 later?

	var server;
    if (swagger.host) {
    	for (var s of swagger.schemes) {
       		server = {};
			server.url = s+'://'+swagger.host+(swagger.basePath ? swagger.basePath : '/');
			server.url = server.url.split('{{').join('{');
			server.url = server.url.split('}}').join('}');
        	openapi.servers.push(server);
    	}
	}
	else {
		server = {};
		server.url = swagger.basePath;
		openapi.servers.push(server);
	}
    delete openapi.host;
    delete openapi.basePath;
    delete openapi.schemes;

    openapi.components = {};
	openapi.components.schemas = openapi.definitions;
	openapi.components.responses = openapi.responses||{};
	openapi.components.parameters = openapi.parameters||[];
	openapi.components.examples = {};
	openapi.components.requestBodies = {};
	openapi.components.securitySchemes = openapi.securityDefinitions||{};
	openapi.components.headers = {};
    delete openapi.definitions;
	delete openapi.responses;
	delete openapi.parameters;
	delete openapi.securityDefinitions;
    // new are [ callbacks, links ]

	for (var s in openapi.components.securitySchemes) {
		processSecurityScheme(openapi.components.securitySchemes[s]);
	}

	for (var p in openapi.components.parameters) {
		var param = openapi.components.parameters[p];
		processParameter(param,null,null,p,openapi);
	}
	for (var r in openapi.components.requestBodies) { // converted ones
		var rb = openapi.components.requestBodies[r];
		var rbStr = JSON.stringify(rb);
		var rbSha1 = sha1(rbStr);
		var entry = {};
		entry.name = r;
		entry.body = rb;
		entry.refs = [];
		requestBodyCache[rbSha1] = entry;
	}

	for (var p in openapi.paths) {
		var path = openapi.paths[p];
		if (path["$ref"]) {
			// external definition only
		}
		else {
			for (var method in path) {
				if ((method == 'get') || (method == 'put') || (method == 'post') || 
					(method == 'delete') || (method == 'options') || (method == 'patch') ||
					(method == 'head') || (method == 'trace')) {
					var op = path[method];

					if (op.parameters) {
						for (var param of op.parameters) {
							processParameter(param,op,path,null,openapi);
						}
						if (!options.debug) {
							op.parameters = op.parameters.filter(deleteParameters);
						}
					}

					//don't need to remove requestBody for non-supported ops "SHALL be ignored"

					// responses
					for (var r in op.responses) {
						var response = op.responses[r];
						if (response.schema) {
							recurse(response.schema,{},function(obj,key,parent){
								if ((key == '$ref') && (typeof obj[key] === 'string')) {
									obj[key] = obj[key].replace('#/definitions/','#/components/schemas/');
								}
								if (key == 'x-anyOf') {
									obj.anyOf = obj[key];
									delete obj[key];
								}	
								if (key == 'x-oneOf') {
									obj.oneOf = obj[key];
									delete obj[key];
								}
							});
							response.content = {};
							response.content["*"] = {};
							response.content["*"].schema = response.schema;
							delete response.schema;
						}
					}

					if (options.debug) {
						op["x-s2o-consumes"] = op.consumes;
						op["x-s2o-produces"] = op.produces;
					}
					delete op.consumes;
					delete op.produces;

					// TODO examples

					if (op.requestBody) {
						var rbStr = JSON.stringify(op.requestBody);
						var rbSha1 = sha1(rbStr);
						if (!requestBodyCache[rbSha1]) {
							var entry = {};
							entry.name = '';
							entry.body = op.requestBody;
							entry.refs = [];
							requestBodyCache[rbSha1] = entry;
						}
						requestBodyCache[rbSha1].refs.push(method+' '+p);
					}

				}
			}
			if (path.parameters) {
				for (var p2 in path.parameters) {
					var param = path.parameters[p2];
					processParameter(param,null,path,p,openapi); // index here is the path string
				}
				if (!options.debug) {
					path.parameters = path.parameters.filter(deleteParameters);
				}
			}
		}
	}

	if (!options.debug) {
		for (var p in openapi.components.parameters) {
			param = openapi.components.parameters[p];
			if (param["x-s2o-delete"]) {
				delete openapi.components.parameters[p];
			}
		}
	}

	recurse(openapi.components.schemas,{},function(obj,key,parent){
		if ((key == '$ref') && (typeof obj[key] === 'string')) {
			obj[key] = obj[key].replace('#/definitions/','#/components/schemas/');
		}
		if (key == 'x-anyOf') {
			obj.anyOf = obj[key];
			delete obj[key];
		}
		if (key == 'x-oneOf') {
			obj.oneOf = obj[key];
			delete obj[key];
		}
	});

	if (options.debug) {
		openapi["x-s2o-consumes"] = openapi.consumes;
		openapi["x-s2o-produces"] = openapi.produces;
	}
	delete openapi.consumes;
	delete openapi.produces;

	openapi.components.requestBodies = {}; // for now as we've dereffed them
	var counter = 0;
	for (var e in requestBodyCache) {
		var entry = requestBodyCache[e];
		if (entry.refs.length>1) {
			if (!entry.name) {
				entry.name = 'requestBody'+counter++;
			}
			// we can reinstate
			openapi.components.requestBodies[entry.name] = entry.body;
			for (var r in entry.refs) {
				var address = entry.refs[r].split(' ');
				var ref = {};
				ref["$ref"] = '#/components/requestBodies/'+entry.name;
				openapi.paths[address[1]][address[0]].requestBody = ref;
			}
		}
	}

    return openapi;
}

module.exports = {

    convert : convert

};
