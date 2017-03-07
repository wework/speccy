'use strict';

var common = require('./common.js');
var jptr = require('jgexml/jpath.js');

// TODO split out into params, security etc
// TODO handle vendor-extensions with plugins?
// TODO x-ms-parameterized-host https://github.com/Azure/azure-rest-api-specs/blob/master/documentation/swagger-extensions.md#x-ms-parameterized-host
// https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-swagger-extensions.html

var targetVersion = '3.0.0-RC0';

function fixupSchema(obj,key,parent){
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
	if ((key == '$ref') && (typeof obj[key] === 'string')) {
		obj[key] = obj[key].replace('#/definitions/','#/components/schemas/');
	}
	if ((key == 'x-ms-odata') && (typeof obj[key] === 'string')) {
		obj[key] = obj[key].replace('#/definitions/','#/components/schemas/');
	}
}

function processSecurityScheme(scheme) {
	if (scheme.type == 'basic') {
		scheme.type = 'http';
		scheme.scheme = 'basic';
	}
	if (scheme.type == 'oauth2') {
		var flow = {};
		var flowName = scheme.flow;
		if (scheme.flow == 'application') flowName = 'clientCredentials';
		if (scheme.flow == 'accessCode') flowName = 'authorizationCode';
		if (typeof scheme.authorizationUrl !== 'undefined') flow.authorizationUrl = scheme.authorizationUrl||'/';
		if (typeof scheme.tokenUrl !== 'undefined') flow.tokenUrl = scheme.tokenUrl||'/';
		flow.scopes = scheme.scopes||{};
		scheme.flow = {};
		scheme.flow[flowName] = flow;
		delete scheme.authorizationUrl;
		delete scheme.tokenUrl;
		delete scheme.scopes;
	}
}

function deleteParameters(value, index, self) {
	return !value["x-s2o-delete"];
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
			// it's gone, chances are it's a requestBody component now unless spec was broken
			// OR external ref - not supported yet
			param["x-s2o-delete"] = true;
			rbody = true;
		}

		// shared formData parameters from swagger or path level could be used in any combination. 
		// we dereference all op.requestBody's then hash them and pull out common ones later

		if (rbody) {
			param = jptr.jptr(openapi,param["$ref"]);
		}
	}

	if (param.type || param.in) { // if it's a real parameter OR we've dereferenced it

		if ((param.type == 'array') && (param.items)) {
			if (param.schema) {
				forceFailure(openapi,'parameter has array,items and schema');
			}
			else {
				param.schema = {};
				param.schema.type = 'array';
				param.schema.items = param.items;
				delete param.type;
				delete param.items;
			}
		}

		if (param.schema) {
			common.recurse(param.schema,{},fixupSchema);
		}
		if (param.collectionFormat) {
			if (param.collectionFormat == 'csv') {
				param.style = 'form';
			}
			if (param.collectionFormat == 'ssv') {
				param.style = 'spaceDelimited';
			}
			if (param.collectionFormat == 'pipes') {
				param.style = 'pipeDelimited';
			}
			delete param.collectionFormat;
		}
		if (param["x-ms-skip-url-encoding"]) {
			param.allowReserved = true;
			if (param.in == 'query') {
				delete param["x-ms-skip-url-encoding"]; // might be in:path, not allowed in OAS3
			}
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
			if (param.description) target.description = param.description;
			if (param.type) target.type = param.type;
			if (typeof param.required !== 'undefined') target.required = param.required;
			if (typeof param.default !== 'undefined') target.default = param.default;
			if (param.format) target.format = param.format;
			if (typeof param.minimum !== 'undefined') target.minimum = param.minimum;
			if (typeof param.maximum !== 'undefined') target.maximum = param.maximum;
			if (typeof param.exclusiveMinimum !== 'undefined') target.exclusiveMinimum = param.exclusiveMinimum;
			if (typeof param.exclusiveMaximum !== 'undefined') target.exclusiveMaximum = param.exclusiveMaximum;
			if (typeof param.minItems !== 'undefined') target.minItems = param.minItems;
			if (typeof param.maxItems !== 'undefined') target.maxItems = param.maxItems;
			if (typeof param.uniqueItems !== 'undefined') target.uniqueItems = param.uniqueItems;
			if (param.pattern) target.pattern = param.pattern;
			if (param.enum) target.enum = param.enum;
			if (typeof param.multipleOf !== 'undefined') target.multipleOf = param.multipleOf;
			if (typeof param.minLength !== 'undefined') target.minLength = param.minLength;
			if (typeof param.maxLength !== 'undefined') target.maxLength = param.maxLength;
			if (target.properties) target.properties = param.properties;
			if (typeof param.minProperties !== 'undefined') target.minProperties = param.minProperties;
			if (typeof param.maxProperties !== 'undefined') target.maxProperties = param.maxProperties;
			if (typeof param.additionalProperties !== 'undefined') target.additionalProperties = param.additionalProperties;
			if (param.allOf) target.allOf = param.allOf; // new are anyOf, oneOf, not, x- vendor extensions?
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
		consumes = consumes.filter(common.uniqueOnly);

		if (!consumes.length) {
			consumes.push('application/json'); // TODO verify default
		}

		for (var mimetype of consumes) {
			result.content[mimetype] = {};
			if (param.description) result.content[mimetype].description = param.description;
			result.content[mimetype].schema = common.clone(param.schema)||{};
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

function processPaths(container,containerName,options,requestBodyCache,openapi) {
	for (var p in container) {
		var path = container[p];
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
					if (!op.responses) {
						var defaultResp = {};
						defaultResp.description = 'Default response';
						op.responses = {default: defaultResp};

					}
					for (var r in op.responses) {
						var response = op.responses[r];
						if (response.schema) {
							common.recurse(response,{},fixupSchema);

							var produces = (op.produces||[]).concat(openapi.produces||[]).filter(common.uniqueOnly);
							if (!produces.length) produces.push('*');
							response.content = {};
							for (var mimetype of produces) {
								response.content[mimetype] = {};
								response.content[mimetype].schema = common.clone(response.schema);
							}
							delete response.schema;
						}
					}

					if (options.debug) {
						op["x-s2o-consumes"] = op.consumes||[];
						op["x-s2o-produces"] = op.produces||[];
					}
					delete op.consumes;
					delete op.produces;

					common.recurse(op,{},fixupSchema); // for x-ms-odata etc

					// TODO examples

					if (op.requestBody) {
						var rbStr = JSON.stringify(op.requestBody);
						var rbSha256 = common.sha256(rbStr);
						if (!requestBodyCache[rbSha256]) {
							var entry = {};
							entry.name = '';
							entry.body = op.requestBody;
							entry.refs = [];
							requestBodyCache[rbSha256] = entry;
						}
						requestBodyCache[rbSha256].refs.push(containerName+' '+method+' '+p);
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
}

function convert(swagger, options) {
	if ((swagger.openapi) && (swagger.openapi.startsWith('3.'))) return swagger;
	if ((!swagger.swagger) || (swagger.swagger != "2.0")) return {}; // handle 1.2 later?

	var requestBodyCache = {};

	var openapi = {};
	openapi.openapi = targetVersion; // semver
	openapi.servers = [];
	// we want the new and existing properties to appear in a sensible order
    openapi = Object.assign(openapi,common.clone(swagger));
    delete openapi.swagger;


	var server;
    if (swagger.host && swagger.schemes) {
    	for (var s of swagger.schemes) {
       		server = {};
			server.url = s+'://'+swagger.host+(swagger.basePath ? swagger.basePath : '/');
			server.url = server.url.split('{{').join('{');
			server.url = server.url.split('}}').join('}');
        	openapi.servers.push(server);
    	}
	}
	else if (swagger.basePath) {
		server = {};
		server.url = swagger.basePath;
		openapi.servers.push(server);
	}
    delete openapi.host;
    delete openapi.basePath;
    delete openapi.schemes;

    openapi.components = {};
	openapi.components.schemas = openapi.definitions||{};
	openapi.components.responses = openapi.responses||{};
	openapi.components.parameters = openapi.parameters||{};
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
		var rbSha256 = common.sha256(rbStr);
		var entry = {};
		entry.name = r;
		entry.body = rb;
		entry.refs = [];
		requestBodyCache[rbSha256] = entry;
	}

	processPaths(openapi.paths,'paths',options,requestBodyCache,openapi);
	if (openapi["x-ms-paths"]) {
		processPaths(openapi["x-ms-paths"],'x-ms-paths',options,requestBodyCache,openapi);
	}

	if (!options.debug) {
		for (var p in openapi.components.parameters) {
			param = openapi.components.parameters[p];
			if (param["x-s2o-delete"]) {
				delete openapi.components.parameters[p];
			}
		}
	}

	common.recurse(openapi.components.schemas,{},fixupSchema);
	common.recurse(openapi.components.schemas,{},fixupSchema); // second pass for fixed x-anyOf's etc

	if (options.debug) {
		openapi["x-s2o-consumes"] = openapi.consumes||[];
		openapi["x-s2o-produces"] = openapi.produces||[];
	}
	delete openapi.consumes;
	delete openapi.produces;

	openapi.components.requestBodies = {}; // for now as we've dereffed them
	var counter = 1;
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
				openapi[address[0]][address[2]][address[1]].requestBody = ref;
			}
		}
	}

	common.recurse(openapi.components.responses,{},fixupSchema);

    return openapi;
}

module.exports = {
	
	targetVersion : targetVersion,
    convert : convert

};
