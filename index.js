'use strict';

function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function recurse(object,parent,callback) {
	for (var key in object) {
		callback(object,key,parent);
		if (typeof object[key] == 'object') {
			recurse(object[key],object,callback);
		}
	}
}

function processParameter(param){
	if (param["$ref"]) {
		param["$ref"] = param["$ref"].replace('#/parameters/','#/components/parameters/');
	}
	else {
		if (param.schema) {
			recurse(param.schema,{},function(object,key,parent){
				if (key == '$ref') {
					object[key] = object[key].replace('#/definitions/','#/components/schemas/');
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
			server.url = s+'://'+swagger.host+swagger.basePath;
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
	openapi.components.responses = openapi.responses;
	openapi.components.parameters = openapi.parameters|[];
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
		processParameter(param);
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

					op.requestBody = {};
					// remove requestBody for non-supported ops?

					if (op.parameters) {
						for (var param of op.parameters) {
							processParameter(param);
						}
					}

					// responses
					for (var r in op.responses) {
						var response = op.responses[r];
						if (response.schema) {
							recurse(response.schema,{},function(obj,key,parent){
								if (key == '$ref') {
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
					processParameter(param);
				}
			}
		}
	}

	// security changes (oAuth)

	recurse(openapi.components.schemas,{},function(obj,key,parent){
		if (key == '$ref') {
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

	delete openapi.consumes;
	delete openapi.produces;

    return openapi;
}

module.exports = {

    convert : convert

};
