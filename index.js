'use strict';

var crypto = require('crypto');

// TODO split out into common, params, security etc

var formDataCache = {};

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
		var target = openapi.components.parameters[ptr];
		if ((!target) || (target["x-s2o-delete"])) {
			// it's gone, chances are it's a requestBody now unless spec was broken
			param["x-s2o-delete"] = true;
		}

		// shared formData parameters could be used in any combination. We could sort and
		// hash them into unique combinations, or alternatively lump them all into one bucket
		// and ensure they're not required:true if they shouldn't be TODO

		if (op) {
			if (!op.requestBodies) op.requestBodies = {};
			if (ptr) {
				op.requestBodies[ptr] = {};
				op.requestBodies[ptr]["$ref"] = '#/components/requestBodies/'+ptr;
			}
			else {
				forceFailure(openapi,'Have lost a shared parameter now requestBody');
			}
		}
		else if (path) {
			if (!path.requestBodies) path.requestBodies = {};
			if (ptr) {
				path.requestBodies[ptr] = {};
				path.requestBodies[ptr]["$ref"] = '#/components/requestBodies/'+ptr;
			}
			else {
				forceFailure(openapi,'Have lost a shared parameter now requestBody');
			}
		}
	}
	else {
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
		// convert to requestBody
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
			if (param.format) target.format = param.format;
			// TODO min/max/exclusive/minItems etc etc
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

		for (var mimetype of consumes) {
			result.content[mimetype] = {};
			result.content[mimetype].description = param.description;
			result.content[mimetype].schema = param.schema||{};
		}
		//if (consumes.length>1) {
		//	forceFailure(openapi,'Body mimetype may not be correct. '+consumes.length);
		//}
	}

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
			if (path.requestBody && singularRequestBody) {
				path.requestBody["x-s2o-overloaded"] = true;
				forceFailure(openapi,'Path has >1 requestBodies');
			}
			else {
				path.requestBody = Object.assign({},op.requestBody);
				if (param.in == 'formData') {
					path.requestBody["x-s2o-partial"] = true;
				}
                if ((path.requestBody.content && path.requestBody.content["application/x-www-form-urlencoded"])
					 && (result.content["application/x-www-form-urlencoded"])) {
				 	path.requestBody.content["application/x-www-form-urlencoded"].properties =
					    Object.assign(path.requestBody.content["application/x-www-form-urlencoded"].properties,result.content["application/x-www-form-urlencoded"].properties);
				}
				else {
					path.requestBody = Object.assign(path.requestBody,result);
				}
			}
		}
		else {
			var uniqueName = index;
			if (!index) {
				forceFailure(openapi,'Named requestBody needs name');
				uniqueName = param.name;
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
			// TODO if we have non-standard path variables here expand them using a regex?
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

					// remove requestBody for non-supported ops? SHALL be ignored
					//if (op.requestBody && method != 'put' && method != 'post') {
					//	forceFailure(openapi,'requestBody on get style operation');
					//}

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

					// examples

					// file types

				}
			}
			if (path.parameters) {
				for (var p in path.parameters) {
					var param = path.parameters[p];
					processParameter(param,null,path,null,openapi);
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

    return openapi;
}

module.exports = {

    convert : convert

};
