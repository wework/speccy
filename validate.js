var path = require('path');
var url = require('url');
var URL = url.URL;
var util = require('util');

var should = require('should');
var ajv = require('ajv')({
	allErrors: true,
	verbose: true,
	jsonPointers: true
});

var jptr = require('jgexml/jpath.js');
var common = require('./common.js');

var jsonSchema = require(path.join(__dirname,'/schemas/json_v5.json'));
var openapi3Schema = require(path.join(__dirname,'/schemas/openapi-3.json'));
var validateMetaSchema = ajv.compile(jsonSchema);
var validateOpenAPI3 = ajv.compile(openapi3Schema);

function contextAppend(options,s) {
	options.context.push((options.context[options.context.length-1]+'/'+s).split('//').join('/'));
}

function validateUrl(s,servers,context,options) {
	if (!options.laxurls) s.should.not.be.exactly('','Invalid empty URL '+context);
	var base = 'http://localhost/'; // could be anything, including options.origin
	if (servers && servers.length) {
		base = servers[0].url;
	}
	var u = URL ? new URL(s,base) : url.parse(s);
	return true; // if we haven't thrown
}

function validateComponentName(name) {
	return /^[a-zA-Z0-9\.\-_]+$/.test(name);
}

function validateSchema(schema,openapi,options) {
	validateMetaSchema(schema);
	var errors = validateSchema.errors;
	if (errors && errors.length) {
		throw(new Error('Schema invalid: '+util.inspect(errors)));
	}
	if (schema.externalDocs) {
		schema.externalDocs.should.have.key('url');
		schema.externalDocs.url.should.have.type('string');
		validateUrl(schema.externalDocs.url,openapi.servers,'externalDocs',options).should.not.throw();
	}
	return !(errors && errors.length);
}

function checkContent(content,openapi,options) {
	contextAppend(options,'content');
	for (var ct in content) {
		contextAppend(options,ct);
		var contentType = content[ct];
		if (contentType.example) {
			contentType.should.not.have.property('examples');
		}
		if (contentType.examples) {
			contentType.should.not.have.property('example');
			contentType.examples.should.be.an.Array();
		}
		if (contentType.schema) validateSchema(contentType.schema,openapi,options);
		options.context.pop();
	}
	options.context.pop();
}

function checkServers(servers,options) {
	servers.should.be.an.Array();
	for (var server of servers) {
		server.should.have.property('url');
		validateUrl(server.url,[],'server.url',options).should.not.throw();
		if (server.variables) {
			for (var v in server.variables) {
				server.variables[v].should.have.key('default');
				server.variables[v].should.be.type('string');
				if (typeof server.variables[v].enum !== 'undefined') {
					server.variables[v].enum.should.be.an.Array();
					should(server.variables[v].enum.length).not.be.exactly(0,'Server variables enum should not be empty');
					for (var enumValue of server.variables[v].enum) {
						enumValue.should.be.type('string');
					}
				}
			}
		}
	}
}

function checkHeader(header,openapi,options) {
	if (header.$ref) {
		var ref = header.$ref;
		should(Object.keys(header).length).be.exactly(1,'Reference object cannot be extended');
		header = common.resolveInternal(openapi,ref);
		should(header).not.be.exactly(false,'Could not resolve reference '+ref);
	}
	header.should.not.have.property('name');
	header.should.not.have.property('in');
	header.should.not.have.property('type');
	for (var prop of common.parameterTypeProperties) {
		header.should.not.have.property(prop);
	}
	if (header.schema) {
		header.should.not.have.property('content');
		validateSchema(header.schema,openapi,options);
	}
	if (header.content) {
		header.should.not.have.property('schema');
		header.should.not.have.property('style');
		checkContent(header.content,openapi,options);
	}
	if (!header.schema && !header.content) {
		header.should.have.property('schema','Header should have schema or content');
	}
}

function checkResponse(response,openapi,options) {
	if (response.$ref) {
		var ref = response.$ref;
		should(Object.keys(response).length).be.exactly(1,'Reference object cannot be extended');
		response = common.resolveInternal(openapi,ref);
		should(response).not.be.exactly(false,'Could not resolve reference '+ref);
	}
	response.should.have.property('description');
	should(response.description).have.type('string','response description should be of type string');
	response.should.not.have.property('examples');
	if (response.headers) {
		contextAppend(options,'headers');
		for (var h in response.headers) {
			contextAppend(options,h);
			checkHeader(response.headers[h],openapi);
			options.context.pop();
		}
		options.context.pop();
	}

	if (response.content) {
		checkContent(response.content,openapi,options);
	}
}

function checkParam(param,index,openapi,options){
	contextAppend(options,index);
	if (param.$ref) {
		should(Object.keys(param).length).be.exactly(1,'Reference object cannot be extended');
		var ref = param.$ref;
		param = common.resolveInternal(openapi,ref);
		should(param).not.be.exactly(false,'Could not resolve reference '+ref);
	}
	param.should.have.property('name');
	param.name.should.have.type('string');
	param.should.have.property('in');
	param.in.should.have.type('string');
	param.in.should.equalOneOf('query','header','path','cookie');
	if (param.in == 'path') {
		param.should.have.property('required');
		param.required.should.be.exactly(true,'Path parameters must have an explicit required:true');
	}
	if (typeof param.required !== 'undefined') should(param.required).have.type('boolean');
	param.should.not.have.property('items');
	param.should.not.have.property('collectionFormat');
	param.should.not.have.property('type');
	for (var prop of common.parameterTypeProperties) {
		param.should.not.have.property(prop);
	}
	param.in.should.not.be.exactly('body','Parameter type body is no-longer valid');
	param.in.should.not.be.exactly('formData','Parameter type formData is no-longer valid');
	if (param.description) {
		param.description.should.have.type('string');
	}
	if (param.schema) {
		param.should.not.have.property('content');
		validateSchema(param.schema,openapi,options);
	}
	if (param.content) {
		param.should.not.have.property('schema');
		param.should.not.have.property('style');
		checkContent(param.content,openapi,options);
	}
	if (!param.schema && !param.content) {
		param.should.have.property('schema','Parameter should have schema or content');
	}
	options.context.pop();
	return true;
}

function checkPathItem(pathItem,openapi,options) {

	var contextServers = [];
	contextServers.push(openapi.servers);
	if (pathItem.servers) contextServers.push(pathItem.servers);

	for (var o in pathItem) {
		contextAppend(options,o);
		var op = pathItem[o];
		if (o == 'parameters') {
			for (var p in pathItem.parameters) {
				checkParam(pathItem.parameters[p],p,openapi,options);
			}
		}
		else if (o == 'servers') {
			checkServers(op,options); // won't be here in converted definitions
		}
		else if (o == 'summary') {
			pathItem.summary.should.have.type('string');
		}
		else if (o == 'description') {
			pathItem.description.should.have.type('string');
		}
		else if (common.httpVerbs.indexOf(o)>=0) {
			op.should.not.have.property('consumes');
			op.should.not.have.property('produces');
			op.should.have.property('responses');
			op.responses.should.not.be.empty();
			if (op.summary) op.summary.should.have.type('string');
			if (op.description) op.description.should.have.type('string');

			if (op.requestBody && op.requestBody.content) {
				contextAppend(options,'requestBody');
				op.requestBody.should.have.property('content');
				if (op.requestBody.description) op.requestBody.description.should.have.type('string');
				if (op.requestBody.required) op.requestBody.required.should.have.type('boolean');
				checkContent(op.requestBody.content,openapi,options);
				options.context.pop();
			}

			contextAppend(options,'responses');
			for (var r in op.responses) {
				contextAppend(options,r);
				var response = op.responses[r];
				checkResponse(response,openapi,options);
				options.context.pop();
			}
			options.context.pop();

			if (op.parameters) {
				contextAppend(options,'parameters');
				for (var p in op.parameters) {
					checkParam(op.parameters[p],p,openapi,options);
				}
				options.context.pop();
			}
			if (op.servers) {
				checkServers(op.servers,options); // won't be here in converted definitions
				contextServers.push(op.servers);
			}
			if (op.externalDocs) {
				op.externalDocs.should.have.key('url');
				op.externalDocs.url.should.have.type('string');
				validateUrl(op.externalDocs.url,contextServers[contextServers.length-1],'externalDocs',options).should.not.throw();
			}
		}
		options.context.pop();
	}
	return true;
}

function validateSync(openapi, options, callback) {
	options.valid = false;
	options.context = [];
	options.warnings = [];

	options.context.push('#/');
    openapi.should.not.have.key('swagger');
	openapi.should.have.key('openapi');
	openapi.openapi.should.have.type('string');
	openapi.should.not.have.key('host');
	openapi.should.not.have.key('basePath');
	openapi.should.not.have.key('schemes');
	openapi.should.have.key('paths');
    openapi.should.not.have.key('definitions');
    openapi.should.not.have.key('parameters');
    openapi.should.not.have.key('responses');
    openapi.should.not.have.key('securityDefinitions');
    openapi.should.not.have.key('produces');
    openapi.should.not.have.key('consumes');

	openapi.should.have.key('info');
	contextAppend(options,'info');
	openapi.info.should.have.key('title');
	should(openapi.info.title).be.type('string','title should be of type string');
	openapi.info.should.have.key('version');
	should(openapi.info.version).be.type('string','version should be of type string');
	if (openapi.info.license) {
		contextAppend(options,'license');
		openapi.info.license.should.have.key('name');
		openapi.info.license.name.should.have.type('string');
		options.context.pop();
	}
	if (typeof openapi.info.termsOfService !== 'undefined') {
		should(openapi.info.termsOfService).not.be.Null();
		validateUrl(openapi.info.termsOfService,openapi.servers,'termsOfService',options).should.not.throw();
	}
	options.context.pop();

	if (openapi.servers) {
		checkServers(openapi.servers,options);
	}
	if (openapi.externalDocs) {
		contextAppend(options,'externalDocs');
		openapi.externalDocs.should.have.key('url');
		openapi.externalDocs.url.should.have.type('string');
		validateUrl(openapi.externalDocs.url,openapi.servers,'externalDocs',options).should.not.throw();
		options.context.pop();
	}

	if (openapi.tags) {
		for (var tag of openapi.tags) {
			tag.should.have.property('name');
			tag.name.should.have.type('string');
			if (tag.externalDocs) {
				tag.externalDocs.should.have.key('url');
				tag.externalDocs.url.should.have.type('string');
				validateUrl(tag.externalDocs.url,openapi.servers,'tag.externalDocs',options).should.not.throw();
			}
		}
	}

    if (openapi.components && openapi.components.securitySchemes) {
        for (var s in openapi.components.securitySchemes) {
			options.context.push('#/components/securitySchemes/'+s);
			validateComponentName(s).should.be.equal(true,'component name invalid');
            var scheme = openapi.components.securitySchemes[s];
			scheme.should.have.property('type');
			scheme.type.should.have.type('string');
            scheme.type.should.not.be.exactly('basic','Security scheme basic should be http with scheme basic');
			scheme.type.should.equalOneOf('apiKey','http','oauth2','openIdConnect');
			if (scheme.type == 'http') {
				scheme.should.have.property('scheme');
				scheme.scheme.should.have.type('string');
				if (scheme.scheme != 'bearer') {
					scheme.should.not.have.property('bearerFormat');
				}
			}
			else {
				scheme.should.not.have.property('scheme');
				scheme.should.not.have.property('bearerFormat');
			}
			if (scheme.type == 'apiKey') {
				scheme.should.have.property('name');
				scheme.name.should.have.type('string');
				scheme.should.have.property('in');
				scheme.in.should.have.type('string');
				scheme.in.should.equalOneOf('query','header');
			}
			else {
				scheme.should.not.have.property('name');
				scheme.should.not.have.property('in');
			}
			if (scheme.type == 'oauth2') {
				scheme.should.not.have.property('flow');
				scheme.should.have.property('flows');
				for (var f in scheme.flows) {
					var flow = scheme.flows[f];
					if ((f == 'implicit') || (f == 'authorizationCode')) {
						flow.should.have.property('authorizationUrl');
						flow.authorizationUrl.should.have.type('string');
						validateUrl(flow.authorizationUrl,openapi.servers,'authorizationUrl',options).should.not.throw();
					}
					else {
						flow.should.not.have.property('authorizationUrl');
					}
					if ((f == 'password') || (f == 'clientCredentials') ||
						(f == 'authorizationCode')) {
						flow.should.have.property('tokenUrl');
						flow.tokenUrl.should.have.type('string');
						validateUrl(flow.tokenUrl,openapi.servers,'tokenUrl',options).should.not.throw();
					}
					else {
						flow.should.not.have.property('tokenUrl');
					}
					if (typeof flow.refreshUrl !== 'undefined') {
						validateUrl(flow.refreshUrl,openapi.servers,'refreshUrl',options).should.not.throw();
					}
					flow.should.have.property('scopes');
				}
			}
			else {
				scheme.should.not.have.property('flows');
			}
			if (scheme.type == 'openIdConnect') {
				scheme.should.have.property('openIdConnectUrl');
				scheme.openIdConnectUrl.should.have.type('string');
				validateUrl(scheme.openIdConnectUrl,openapi.servers,'openIdConnectUrl',options).should.not.throw();
			}
			else {
				scheme.should.not.have.property('openIdConnectUrl');
			}
			options.context.pop();
        }
    }

    should.ok(openapi.openapi.startsWith('3.0.'),'Must be an OpenAPI 3.0.x document');

    common.recurse(openapi,null,function(obj,key,state){
        if ((key === '$ref') && (typeof obj[key] === 'string')) {
			options.context.push(state.path);
            should(obj[key].indexOf('#/definitions/')).be.exactly(-1,'Reference to #/definitions');
			should(Object.keys(obj).length).be.exactly(1,'Reference object cannot be extended');
			should(jptr.jptr(openapi,obj[key])).not.be.exactly(false,'Cannot resolve reference: '+obj[key]);
			options.context.pop();
        }
    });

    if (openapi.components && openapi.components.parameters) {
		options.context.push('#/components/parameters/');
        for (var p in openapi.components.parameters) {
            checkParam(openapi.components.parameters[p],p,openapi,options);
			contextAppend(options, p);
			validateComponentName(p).should.be.equal(true,'component name invalid');
			options.context.pop();
        }
		options.context.pop();
    }
    for (var p in openapi.paths) {
		options.context.push('#/paths/'+jptr.jpescape(p));
        checkPathItem(openapi.paths[p],openapi,options);
		options.context.pop();
    }
    if (openapi["x-ms-paths"]) {
        for (var p in openapi["x-ms-paths"]) {
			options.context.push('#/x-ms-paths/'+jptr.jpescape(p));
            checkPathItem(openapi["x-ms-paths"][p],openapi,options);
			options.context.pop();
        }
    }

	if (openapi.components && openapi.components.schemas) {
		for (var s in openapi.components.schemas) {
			options.context.push('#/components/schemas/'+s);
			validateComponentName(s).should.be.equal(true,'component name invalid');
			validateSchema(openapi.components.schemas[s],openapi,options);
			options.context.pop();
		}
	}

	if (openapi.components && openapi.components.responses) {
		for (var r in openapi.components.responses) {
			options.context.push('#/components/responses/'+r);
			validateComponentName(r).should.be.equal(true,'component name invalid');
			checkResponse(openapi.components.responses[r],openapi,options);
			options.context.pop();
		}
	}

	if (openapi.components && openapi.components.headers) {
		for (var h in openapi.components.headers) {
			options.context.push('#/components/headers/'+h);
			validateComponentName(h).should.be.equal(true,'component name invalid');
			checkHeader(openapi.components.headers[h],openapi,options);
			options.context.pop();
		}
	}

	if (openapi.components && openapi.components.requestBodies) {
		for (var r in openapi.components.requestBodies) {
			options.context.push('#/components/requestBodies/'+r);
			validateComponentName(r).should.be.equal(true,'component name invalid');
			if (r.startsWith('requestBody')) {
				options.warnings.push('Anonymous requestBody: '+r);
			}
			options.context.pop();
		}
	}

    validateOpenAPI3(openapi);

    validateOpenAPI3(openapi);
    var errors = validateOpenAPI3.errors;
    if (errors && errors.length) {
	    throw(new Error('Failed OpenAPI3 schema validation: '+JSON.stringify(errors,null,2)));
    }

	options.valid = !options.expectFailure;
	if (callback) callback(null,options);
    return options.valid;
}

function validate(openapi, options, callback) {
	process.nextTick(function(){
		validateSync(openapi, options, callback);
	});
}

module.exports = {
    validateSync : validateSync,
    validate : validate
}
