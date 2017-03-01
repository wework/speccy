'use strict';

function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function uniqueOnly(value, index, self) {
    return self.indexOf(value) === index;
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

function processParameter(param,op,path,openapi) {
	var result = {};
	var singularRequestBody = true;

	if (param["$ref"]) {
		param["$ref"] = param["$ref"].replace('#/parameters/','#/components/parameters/');
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
			result.content["application/x-www-form-urlencoded"].properties[param.name].description = param.description;
			result.content["application/x-www-form-urlencoded"].properties[param.name].type = param.type;
			// TODO handle items for arrays?
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
				forceFailure(openapi,'Path has >1 requestBodies');
			}
			else {
				path.requestBody = Object.assign({},op.requestBody,result);
			}
		}
		else {
			var uniqueName = 'TODO';
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
			// TODO if we have non-standard path variables here expand them using a regex
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
	openapi.components.securitySchemes = openapi.securityDefinitions;
	openapi.components.headers = {};
    delete openapi.definitions;
	delete openapi.responses;
	delete openapi.parameters;
	delete openapi.securityDefinitions;
    // new are [ callbacks, links ]

	for (var p in openapi.components.parameters) {
		var param = openapi.components.parameters[p];
		processParameter(param,null,null,openapi);
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
							processParameter(param,op,path,openapi);
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
									obj[key] = obj[key].replace('#/definitions/','#/components/schemas');
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
					processParameter(param,null,path,openapi);
				}
			}
		}
	}

	// security changes (oAuth)

	recurse(openapi.components.schemas,{},function(obj,key,parent){
		if ((key == '$ref') && (typeof obj[key] === 'string')) {
			obj[key] = obj[key].replace('#/definitions/','#/components/schemas');
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

	openapi["x-s2o-consumes"] = openapi.consumes;
	delete openapi.consumes;
	openapi["x-s2o-produces"] = openapi.produces;
	delete openapi.produces;

    return openapi;
}

module.exports = {

    convert : convert

};
