var url = require('url');
var should = require('should');

var jptr = require('jgexml/jpath.js');
var common = require('./common.js');

// TODO validate with ajv when schema published
// TODO requestBody.content may become REQUIRED in RC1

function validateUrl(s) {
	if (s === '') throw(new Error('Invalid URL'));
	var u = url.parse(s);
	return true; // if we haven't thrown
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

function checkParam(param,openapi,options){
	if (param.$ref) {
		param = jptr.jptr(openapi,param.$ref);
	}
	param.should.have.property('name');
	param.should.have.property('in');
	if (options.verbose) console.log('p:'+param.name+' '+param.in);
	if (param.in == 'path') {
		param.should.have.property('required');
		param.required.should.be.exactly(true,'Path parameters must have an explicit required:true');
	}
	param.should.not.have.property('items');
	param.should.not.have.property('collectionFormat');
	if (param.type) param.type.should.not.be.exactly('file','Parameter type file is no-longer valid');
	param.in.should.not.be.exactly('body','Parameter type body is no-longer valid');
	param.in.should.not.be.exactly('formData','Parameter type formData is no-longer valid');
	return true;
}

function checkPathItem(pathItem,openapi,options) {
	for (var o in pathItem) {
		var op = pathItem[o];
		if (o == 'parameters') {
			for (var param of pathItem.parameters) {
				checkParam(param,openapi,options);
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
			if (options.verbose) console.log('o:'+o);
			op.should.have.property('responses');
			op.responses.should.not.be.empty();
			op.should.not.have.property('consumes');
			op.should.not.have.property('produces');
			if (op.parameters) {
				for (var param of op.parameters) {
					checkParam(param,openapi,options);
				}
			}
			if (op.externalDocs) {
				op.externalDocs.should.have.key('url');
				validateUrl(op.externalDocs.url).should.not.throw();
			}
			if (op.servers) {
				checkServers(op.servers);
			}
		}
	}
}

function validate(openapi, options) {
    openapi.should.not.have.key('swagger');
	openapi.should.have.key('openapi');
	openapi.should.have.key('info');
	openapi.info.should.have.key('title');
	openapi.info.should.have.key('version');
	if (openapi.info.license) {
		openapi.info.license.should.have.key('name');
	}
	if (openapi.servers) {
		checkServers(openapi.servers);
	}
	openapi.should.have.key('paths');
    openapi.should.not.have.key('definitions');
    openapi.should.not.have.key('parameters');
    openapi.should.not.have.key('responses');
    openapi.should.not.have.key('securityDefinitions');
    openapi.should.not.have.key('produces');
    openapi.should.not.have.key('consumes');
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
            checkParam(openapi.components.parameters[p],openapi,options);
        }
    }
    for (var p in openapi.paths) {
		if (options.verbose) console.log(p);
        checkPathItem(openapi.paths[p],openapi,options);
    }
    if (openapi["x-ms-paths"]) {
        for (var p in openapi["x-ms-paths"]) {
			if (options.verbose) console.log(p);
            checkPathItem(openapi["x-ms-paths"][p],openapi,options);
        }
    }

    return true;
}

module.exports = {
    validate : validate
}
