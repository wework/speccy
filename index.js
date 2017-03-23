'use strict';

var fs = require('fs');
var util = require('util');

var co = require('co');
var fetch = require('node-fetch');
var yaml = require('js-yaml');

var common = require('./common.js');

// TODO split out into params, security etc
// TODO handle specification-extensions with plugins?
// TODO https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-swagger-extensions.html

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
	if ((key == '$ref') && (typeof obj[key] === 'string') && (obj[key].indexOf('#/definitions/')>=0)) {
		obj[key] = '#/components/schemas/'+common.sanitise(obj[key].replace('#/definitions/',''));
		Object.keys(obj).forEach(function(k){
			if (k !== '$ref') delete obj[k];
		});
	}
	if ((key == 'x-ms-odata') && (typeof obj[key] === 'string')) {
		obj[key] = '#/components/schemas/'+common.sanitise(obj[key].replace('#/definitions/',''));
	}
}

function processSecurity(securityObject) {
	for (var s in securityObject) {
		for (var k in securityObject[s]) {
			var sname = common.sanitise(k);
			if (k != sname) {
				securityObject[s][sname] = securityObject[s][k];
				delete securityObject[s][k];
			}
		}
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
		scheme.flow = {}; // may become flows in RC1
		scheme.flow[flowName] = flow;
		delete scheme.authorizationUrl;
		delete scheme.tokenUrl;
		delete scheme.scopes;
	}
}

function deleteParameters(value, index, self) {
	return !value["x-s2o-delete"];
}

function processHeader(header) {
	if (header.type && !header.schema) {
		header.schema = {};
	}
	if (header.type) header.schema.type = header.type;
	delete header.type;
	for (var prop of common.parameterTypeProperties) {
		if (typeof header[prop] !== 'undefined') {
			header.schema[prop] = header[prop];
			delete header[prop];
		}
	}
}

function processParameter(param,op,path,index,openapi) {
	var result = {};
	var singularRequestBody = true;

	var consumes = ((op && op.consumes)||[]).concat(openapi.consumes||[]);
	consumes = consumes.filter(common.uniqueOnly);

	if (param.$ref) {
		// if we still have a ref here, it must be an internal one
		param.$ref = '#/components/parameters/'+common.sanitise(param.$ref.replace('#/parameters/',''));
		var ptr = param.$ref.replace('#/components/parameters/','');
		var rbody = false;
		var target = openapi.components.parameters[ptr]; // resolves a $ref, must have been sanitised already

		if ((!target) || (target["x-s2o-delete"])) {
			// if it's gone, chances are it's a requestBody component now unless spec was broken
			param["x-s2o-delete"] = true;
			rbody = true;
		}

		// shared formData parameters from swagger or path level could be used in any combination. 
		// we dereference all op.requestBody's then hash them and pull out common ones later

		if (rbody) {
			param = common.resolveInternal(openapi,param.$ref);
			if (!param) throw(new Error('Could not resolve reference '+param.ref));
		}
	}

	if (param.name || param.in) { // if it's a real parameter OR we've dereferenced it

		if (param.type && (param.type != 'object') && (param.type != 'body') && (param.in != 'formData')) {
			if (param.items && param.schema) {
				throw(new Error('parameter has array,items and schema'));
			}
			else {
				if (!param.schema) param.schema = {};
				param.schema.type = param.type;
				if (param.items) {
					param.schema.items = param.items;
					delete param.items;
				}
				for (var prop of common.parameterTypeProperties) {
					if (typeof param[prop] !== 'undefined') param.schema[prop] = param[prop];
					delete param.prop;
				}
			}
		}

		if (param.schema) {
			common.recurse(param.schema,{},'','',fixupSchema);
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
		var contentType = 'application/x-www-form-urlencoded';
		if ((consumes.length) && (consumes[0] == 'multipart/form-data')) {
			contentType = 'multipart/form-data';
		}
		
		result.content[contentType] = {};
		if (param.schema) {
			result.content[contentType].schema = param.schema;
			if (param.schema.$ref) {
				result['x-s2o-name'] = param.schema.$ref.replace('#/components/schemas/','');
			}
		}
		else {
			result.content[contentType].schema = {};
			result.content[contentType].schema.type = 'object';
			result.content[contentType].schema.properties = {};
			result.content[contentType].schema.properties[param.name] = {};
			var target = result.content[contentType].schema.properties[param.name];
			if (param.description) target.description = param.description;
			if (param.type) target.type = param.type;

			for (var prop of common.parameterTypeProperties) {
				if (typeof param[prop] !== 'undefined') target[prop] = param[prop];
			}
			if (typeof param.required !== 'undefined') target.required = param.required;
			if (typeof param.default !== 'undefined') target.default = param.default;
			if (target.properties) target.properties = param.properties;
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

		if (param.schema && param.schema.$ref) {
			result['x-s2o-name'] = param.schema.$ref.replace('#/components/schemas/','');
		}
		else if (param.schema && (param.schema.type == 'array') && param.schema.items && param.schema.items.$ref) {
			result['x-s2o-name'] = param.schema.items.$ref.replace('#/components/schemas/','')+'Array';
		}

		if (!consumes.length) {
			consumes.push('application/json'); // TODO verify default
		}

		for (var mimetype of consumes) {
			result.content[mimetype] = {};
			if (param.description) result.content[mimetype].description = param.description;
			result.content[mimetype].schema = common.clone(param.schema)||{};
		}
	}

	if (Object.keys(result).length > 0) {
		param["x-s2o-delete"] = true;
		// work out where to attach the requestBody
		if (op) {
			if (op.requestBody && singularRequestBody) {
				op.requestBody["x-s2o-overloaded"] = true;
				throw(new Error('Operation has >1 requestBodies'));
			}
			else {
				op.requestBody = Object.assign({},op.requestBody); // make sure we have one
				if ((op.requestBody.content && op.requestBody.content["multipart/form-data"]) 
					&& (result.content["multipart/form-data"])) {
					op.requestBody.content["multipart/form-data"].schema.properties =
						Object.assign(op.requestBody.content["multipart/form-data"].schema.properties,result.content["multipart/form-data"].schema.properties);
				}
				else if ((op.requestBody.content && op.requestBody.content["application/x-www-form-urlencoded"]) 
					&& (result.content["application/x-www-form-urlencoded"])) {
					op.requestBody.content["application/x-www-form-urlencoded"].schema.properties =
						Object.assign(op.requestBody.content["application/x-www-form-urlencoded"].schema.properties,result.content["application/x-www-form-urlencoded"].schema.properties);
				}
				else {
					op.requestBody = Object.assign(op.requestBody,result);
					if (!op.requestBody['x-s2o-name']) {
						if (op.requestBody.schema && op.requestBody.schema.$ref) {
							op.requestBody['x-s2o-name'] = op.requestBody.schema.$ref.replace('#/components/schemas/','').split('/').join('');
						}
						else if (op.operationId) {
							op.requestBody['x-s2o-name'] = op.operationId;
						}
					}
				}
			}
		}
		else if (path) {
			var uniqueName = index ? index.toCamelCase()+'RequestBodyBase' : param.name;
			if (param.in == 'formData') {
				result["x-s2o-partial"] = true;
			}
			openapi.components.requestBodies[uniqueName] = result;
		}
		else {
			var uniqueName = index ? index : param.name;
			if (param.in == 'formData') {
				result["x-s2o-partial"] = true;
			}
			openapi.components.requestBodies[uniqueName] = result;
		}
	}

	// tidy up
	delete param.type;
	for (var prop of common.parameterTypeProperties) {
		delete param[prop];
	}

	return result;
}

function processPaths(container, containerName, options, requestBodyCache, openapi) {
	for (var p in container) {
		var path = container[p];
		// path.$ref is external only
		for (var method in path) {
			if (common.httpVerbs.indexOf((method) > 0)) {
				var op = path[method];

				if (op.parameters) {
					for (var param of op.parameters) {
						processParameter(param, op, path, null, openapi);
					}
					if (!options.debug) {
						op.parameters = op.parameters.filter(deleteParameters);
					}
				}

				if (op.security) processSecurity(op.security);

				//don't need to remove requestBody for non-supported ops "SHALL be ignored"

				// responses
				if (!op.responses) {
					var defaultResp = {};
					defaultResp.description = 'Default response';
					op.responses = { default: defaultResp };
				}
				for (var r in op.responses) {
					var response = op.responses[r];
					if (response.$ref) {
						if (typeof response.description !== 'undefined') {
							if (options.patch) {
								delete response.description;
							}
							else {
								throw (new Error('$ref object cannot be extended: ' + response.$ref));
							}
						}
						if (response.$ref.indexOf('#/definitions/') >= 0) {
							//response.$ref = '#/components/schemas/'+common.sanitise(response.$ref.replace('#/definitions/',''));
							throw (new Error('definition used as response: ' + response.$ref));
						}
						else {
							response.$ref = '#/components/responses/' + common.sanitise(response.$ref.replace('#/responses/', ''));
						}
					}
					else {
						if ((typeof response.description === 'undefined') || (response.description === null)) {
							if (options.patch) {
								response.description = '';
							}
							else {
								throw (new Error('response.description is mandatory'));
							}
						}
						if (response.schema) {
							common.recurse(response.schema, {}, '', '', fixupSchema); // was response

							var produces = (op.produces || []).concat(openapi.produces || []).filter(common.uniqueOnly);
							if (!produces.length) produces.push('*/*'); // TODO verify default
							response.content = {};
							for (var mimetype of produces) {
								response.content[mimetype] = {};
								response.content[mimetype].schema = common.clone(response.schema);
								if (response.examples && response.examples[mimetype]) {
									response.content[mimetype].examples = [];
									response.content[mimetype].examples.push(response.examples[mimetype]);
									delete response.examples[mimetype];
								}
								if (response.content[mimetype].schema.type == 'file') {
									delete response.content[mimetype].schema;
								}
							}
							delete response.schema;
						}
						// examples for other types
						for (var mimetype in response.examples) {
							if (!response.content) response.content = {};
							if (!response.content[mimetype]) response.content[mimetype] = {};
							response.content[mimetype].examples = [];
							response.content[mimetype].examples.push(response.examples[mimetype]);
						}
						delete response.examples;
						if (response.headers) {
							for (var h in response.headers) {
								processHeader(response.headers[h]);
							}
						}
					}
				}

				if (options.debug) {
					op["x-s2o-consumes"] = op.consumes || [];
					op["x-s2o-produces"] = op.produces || [];
				}
				delete op.consumes;
				delete op.produces;

				common.recurse(op, {}, '', '', fixupSchema); // for x-ms-odata etc

				if (op.requestBody) {
					var rbName = op.requestBody['x-s2o-name']||'';
					delete op.requestBody['x-s2o-name'];
					var rbStr = JSON.stringify(op.requestBody);
					var rbSha256 = common.sha256(rbStr);
					if (!requestBodyCache[rbSha256]) {
						var entry = {};
						entry.name = rbName;
						entry.body = op.requestBody;
						entry.refs = [];
						requestBodyCache[rbSha256] = entry;
					}
					requestBodyCache[rbSha256].refs.push(containerName + ' ' + method + ' ' + p); // might be easier to use a JSON Pointer here
				}

			}
		}
		if (path.parameters) {
			for (var p2 in path.parameters) {
				var param = path.parameters[p2];
				processParameter(param, null, path, p, openapi); // index here is the path string
			}
			if (!options.debug) {
				path.parameters = path.parameters.filter(deleteParameters);
			}
		}
	}
}

function main(openapi, options) {

	var requestBodyCache = {};

	if (openapi.security) processSecurity(openapi.security);

	for (var s in openapi.components.securitySchemes) {
		var sname = common.sanitise(s);
		if (s != sname) {
			if (openapi.components.securitySchemes[sname]) {
				throw(new Error('Duplicate sanitised securityScheme name '+sname));
			}
			openapi.components.securitySchemes[sname] = openapi.components.securitySchemes[s];
			delete openapi.components.securitySchemes[s];
		}
		processSecurityScheme(openapi.components.securitySchemes[sname]);
	}

	for (var s in openapi.components.schemas) {
		var sname = common.sanitise(s);
		if (s != sname) {
			if (openapi.components.schemas[sname]) {
				throw(new Error('Duplicate sanitised schema name '+sname));
			}
			openapi.components.schemas[sname] = openapi.components.schemas[s];
			delete openapi.components.schemas[s];
		}
	}

	for (var p in openapi.components.parameters) {
		var sname = common.sanitise(p);
		if (p != sname) {
			if (openapi.components.parameters[sname]) {
				throw(new Error('Duplicate sanitised parameter name '+sname));
			}
			openapi.components.parameters[sname] = openapi.components.parameters[p];
			delete openapi.components.parameters[p];
		}
		var param = openapi.components.parameters[sname];
		processParameter(param,null,null,sname,openapi);
	}

	for (var r in openapi.components.responses) {
		var sname = common.sanitise(r);
		if (r != sname) {
			if (openapi.components.responses[sname]) {
				throw(new Error('Duplicate sanitised response name '+sname));
			}
			openapi.components.responses[sname] = openapi.components.responses[r];
			delete openapi.components.responses[r];
		}
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

	common.recurse(openapi.components.schemas,{},'','',fixupSchema);
	common.recurse(openapi.components.schemas,{},'','',fixupSchema); // second pass for fixed x-anyOf's etc

	if (options.debug) {
		openapi["x-s2o-consumes"] = openapi.consumes||[];
		openapi["x-s2o-produces"] = openapi.produces||[];
	}
	delete openapi.consumes;
	delete openapi.produces;

	var rbNamesGenerated = [];

	openapi.components.requestBodies = {}; // for now as we've dereffed them
	var counter = 1;
	for (var e in requestBodyCache) {
		var entry = requestBodyCache[e];
		if (entry.refs.length>1) {
			// create a shared requestBody
			var suffix = '';
			if (!entry.name) {
				entry.name = 'requestBody';
				suffix = counter++;
			}
			while (rbNamesGenerated.indexOf(entry.name+suffix)>=0) {
				// this can happen if descriptions are not exactly the same (e.g. bitbucket)
				suffix = (suffix ? suffix++ : '2');
			}
			entry.name = entry.name+suffix;
			rbNamesGenerated.push(entry.name);
			openapi.components.requestBodies[entry.name] = entry.body;
			for (var r in entry.refs) {
				var address = entry.refs[r].split(' ');
				var ref = {};
				ref.$ref = '#/components/requestBodies/'+entry.name;
				openapi[address[0]][address[2]][address[1]].requestBody = ref; // might be easier to use a JSON Pointer here
			}
		}
	}

	common.recurse(openapi.components.responses,{},'','',fixupSchema);
	for (var r in openapi.components.responses) {
		var response = openapi.components.responses[r];
		if (response.headers) {
			for (var h in response.headers) {
				processHeader(response.headers[h]);
			}
		}
	}

	return openapi;
}

function convertObj(swagger, options, callback) {
	if ((swagger.openapi) && (swagger.openapi.startsWith('3.'))) return swagger;
	if ((!swagger.swagger) || (swagger.swagger != "2.0")) return {}; // handle 1.2 later?

	var openapi = {};
	openapi.openapi = targetVersion; // semver
	openapi.servers = [];

	if (options.origin) {
		if (!openapi["x-origin"]) {
			openapi["x-origin"] = [];
		}
		var origin = {};
		origin.url = options.origin;
		origin.format = 'swagger';
		origin.version = swagger.swagger;
		origin.converter = {};
		origin.converter.url = 'https://github.com/mermade/swagger2openapi';
		origin.converter.version = common.getVersion();
		openapi["x-origin"].push(origin);
	}

	// we want the new and existing properties to appear in a sensible order. Not guaranteed
    openapi = Object.assign(openapi,common.clone(swagger));
    delete openapi.swagger;

	var server;
	if (swagger.host && swagger.schemes) {
		for (var s of swagger.schemes) {
			server = {};
			server.url = s + '://' + swagger.host + (swagger.basePath ? swagger.basePath : '/');
			server.url = server.url.split('{{').join('{');
			server.url = server.url.split('}}').join('}');
			// TODO server variables (:style parameters?)
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

	if (swagger['x-ms-parameterized-host']) {
		var xMsPHost = swagger['x-ms-parameterized-host'];
		var server = {};
		server.url = xMsPHost.hostTemplate;
		server.parameters = xMsPHost.parameters;
		for (var param of server.parameters) {
			if (param.ref === false) param.required = true; // has a different meaning
			delete param.type; // all strings
			if (param.$ref) {
				param.$ref = param.$ref.replace('#/parameters/','#/components/parameters/');
			}
		}
		openapi.servers.push(server);
		delete openapi['x-ms-parameterized-host'];
	}

	if ((typeof openapi.info.version === 'undefined') || (openapi.info.version === null)) {
		if (options.patch) {
			openapi.info.version = '';
		}
		else {
			throw(new Error('info.version cannot be null'));
		}
	}

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

	var actions = [];

	if (options.resolve) {
		common.recurse(openapi,{},'','',function(obj,key,parent,pkey,path){
			if ((key === '$ref') && (typeof obj[key] === 'string')) {
				if (!obj[key].startsWith('#/')) {
					actions.push(common.resolveExternal(openapi,obj[key],options,function(data){
						parent[pkey] = data;
					}));
				}
			}
		});
	}

	co(function* () {
		// resolve multiple promises in parallel
		var res = yield actions;
		main(openapi, options);
		callback(null, openapi, options);
	})
	.catch(function(err){
		callback(err, openapi, options);
	});

}

function convertStr(str,options,callback) {
	var obj = null;
	try {
		obj = JSON.parse(str);
	}
	catch (ex) {
		try {
			obj = yaml.safeLoad(str);
			options.sourceYaml = true;
		}
		catch (ex) {}
	}
	if (obj) {
		convertObj(obj,options,callback);
	}
	else {
		callback(new Error('Could not resolve url'),null,options);
	}
}

function convertUrl(url,options,callback) {
	if (!options.origin) {
		options.origin = url;
	}
	if (options.verbose) {
		console.log('GET '+url);
	}
	fetch(url).then(function(res) {
    	return res.text();
	}).then(function(body) {
		convertStr(body,options,callback);
	}).catch(function(err){
		callback(err,null,options);
	});
}

function convertFile(filename,options,callback) {
	fs.readFile(filename,options.encoding||'utf8',function(err,s){
		if (err) {
			callback(err,null,options);
		}
		else {
			options.sourceFile = filename;
			convertStr(s,options,callback);
		}
	});
}

module.exports = {
	
	targetVersion : targetVersion,
    convert : convertObj,
	convertObj : convertObj,
	convertUrl : convertUrl,
	convertStr : convertStr,
	convertFile : convertFile

};
