var url = require('url');
var URL = url.URL;
var util = require('util');
var should = require('should');

var jptr = require('jgexml/jpath.js');
var common = require('./common.js');

// TODO validate with ajv when schema published
// TODO requestBody.content may become REQUIRED in RC1

function contextAppend(options,s) {
	options.context.push((options.context[options.context.length-1]+'/'+s).split('//').join('/'));
}

function validateUrl(s) {
	if (s === '') throw(new Error('Invalid URL'));
	var u = URL ? new URL(s) : url.parse(s);
	return true; // if we haven't thrown
}

function validateComponentName(name) {
	return name.match(/[a-zA-Z0-9.\-_]+/);
}

function checkServers(servers) {
	for (var server of servers) {
		if (server.url) { // TODO may change to REQUIRED in RC1
			validateUrl(server.url).should.not.throw();
		}
		if (server.variables) {
			for (var v in server.variables) {
				server.variables[v].should.have.key('default');
			}
		}
	}
}

function checkResponse(response,openapi){
	if (response.$ref) {
		response = jptr.jptr(openapi,response.$ref);
	}
	response.should.have.property('description');
	should(response.description).have.type('string','response description should be of type string');
}

function checkParam(param,index,openapi,options){
	contextAppend(options,index);
	if (param.$ref) {
		param = jptr.jptr(openapi,param.$ref);
	}
	param.should.have.property('name');
	param.should.have.property('in');
	if (param.in == 'path') {
		param.should.have.property('required');
		param.required.should.be.exactly(true,'Path parameters must have an explicit required:true');
	}
	param.should.not.have.property('items');
	param.should.not.have.property('collectionFormat');
	if (param.type) param.type.should.not.be.exactly('file','Parameter type file is no-longer valid');
	param.in.should.not.be.exactly('body','Parameter type body is no-longer valid');
	param.in.should.not.be.exactly('formData','Parameter type formData is no-longer valid');
	options.context.pop();
	return true;
}

function checkPathItem(pathItem,openapi,options) {
	for (var o in pathItem) {
		contextAppend(options,o);
		var op = pathItem[o];
		if (o == 'parameters') {
			for (var p in pathItem.parameters) {
				checkParam(pathItem.parameters[p],p,openapi,options);
			}
		}
		else if (o.startsWith('x-')) {
			// nop
		}
		else if (o == 'summary') {
			// nop
		}
		else if (o == 'description') {
			// nop
		}
		else if (o == 'servers') {
			checkServers(op); // won't be here in converted specs
		}
		else {
			op.should.not.have.property('consumes');
			op.should.not.have.property('produces');
			op.should.have.property('responses');
			op.responses.should.not.be.empty();

			contextAppend(options,'responses');
			for (var r in op.responses) {
				contextAppend(options,r);
				var response = op.responses[r];
				checkResponse(response,openapi);
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
			if (op.externalDocs) {
				op.externalDocs.should.have.key('url');
				validateUrl(op.externalDocs.url).should.not.throw();
			}
			if (op.servers) {
				checkServers(op.servers);
			}
		}
		options.context.pop();
	}
}

function validate(openapi, options) {
	options.context = [];
	options.context.push('#/');
    openapi.should.not.have.key('swagger');
	openapi.should.have.key('openapi');
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
	openapi.info.should.have.key('version');
	should(openapi.info.version).be.type('string','version should be of type string');
	if (openapi.info.license) {
		openapi.info.license.should.have.key('name');
	}
	if (openapi.info.termsOfService) {
		validateUrl(openapi.info.termsOfService).should.not.throw();
	}
	options.context.pop();

	if (openapi.servers) {
		checkServers(openapi.servers);
	}
	if (openapi.externalDocs) {
		openapi.externalDocs.should.have.key('url');
		validateUrl(openapi.externalDocs.url).should.not.throw();
	}

	// TODO externalDocs.url in schemas?
	if (openapi.tags) {
		for (var tag of openapi.tags) {
			if (tag.externalDocs) {
				tag.externalDocs.should.have.key('url');
				validateUrl(tag.externalDocs.url).should.not.throw();
			}
		}
	}

    if (openapi.components && openapi.components.securitySchemes) {
        for (var s in openapi.components.securitySchemes) {
			options.context.push('#/components/securitySchemes/'+s);
			validateComponentName(s).should.be.ok();
            var scheme = openapi.components.securitySchemes[s];
			scheme.should.have.property('type');
            scheme.type.should.not.be.exactly('basic','Security scheme basic should be http with scheme basic');
			if (scheme.type == 'http') {
				scheme.should.have.property('scheme');
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
				scheme.should.have.property('in');
			}
			else {
				scheme.should.not.have.property('name');
				scheme.should.not.have.property('in');
			}
			if (scheme.type == 'oauth2') {
				scheme.should.have.property('flow'); // TODO may change to flows in RC1
				for (var f in scheme.flow) {
					var flow = scheme.flow[f];
					if ((f == 'implicit') || (f == 'authorizationCode')) {
						flow.should.have.property('authorizationUrl');
						validateUrl(flow.authorizationUrl).should.not.throw();
					}
					else {
						flow.should.not.have.property('authorizationUrl');
					}
					if ((f == 'password') || (f == 'clientCredentials') ||
						(f == 'authorizationCode')) {
						flow.should.have.property('tokenUrl');
						validateUrl(flow.tokenUrl).should.not.throw();
					}
					else {
						flow.should.not.have.property('tokenUrl');
					}
					if (typeof flow.refreshUrl !== 'undefined') {
						validateUrl(flow.refreshUrl).should.not.throw();
					}
					flow.should.have.property('scopes');
				}
			}
			else {
				scheme.should.not.have.property('flow');
			}
			if (scheme.type == 'openIdConnect') {
				scheme.should.have.property('openIdConnectUrl');
				validateUrl(scheme.openIdConnectUrl).should.not.throw();
			}
			else {
				scheme.should.not.have.property('openIdConnectUrl');
			}
			options.context.pop();
        }
    }

    should.ok(openapi.openapi.startsWith('3.0.'),'Must be an OpenAPI 3.0.x document');

    common.recurse(openapi,{},function(obj,key,parent){
        if ((key === '$ref') && (typeof obj[key] === 'string')) {
            should(obj[key].indexOf('#/definitions/')).be.exactly(-1,'Reference to #/definitions');
        }
    });

    if (openapi.components && openapi.components.parameters) {
        for (var p in openapi.components.parameters) {
			options.context.push('#/components/parameters/'+p);
			validateComponentName(p).should.be.ok();
            checkParam(openapi.components.parameters[p],p,openapi,options);
			options.context.pop();
        }
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
			validateComponentName(s).should.be.ok();
			options.context.pop();
		}
	}

	if (openapi.components && openapi.components.responses) {
		for (var r in openapi.components.responses) {
			options.context.push('#/components/responses/'+r);
			validateComponentName(s).should.be.ok();
			checkResponse(openapi.components.responses[r],openapi);
			options.context.pop();
		}
	}

    return true;
}

module.exports = {
    validate : validate
}
