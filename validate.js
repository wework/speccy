var should = require('should');

var jptr = require('jgexml/jpath.js');
var common = require('./common.js');

// TODO validate with ajv when schema published

function checkParam(param,openapi){
	if (param.$ref) {
		param = jptr.jptr(openapi,param.$ref);
	}
	param.should.have.property('name');
	param.should.have.property('in');
	param.should.not.have.property('items');
	param.should.not.have.property('collectionFormat');
	if (param.type) param.type.should.not.be.exactly('file');
	param.in.should.not.be.exactly('body');
	param.in.should.not.be.exactly('formData');
	return true;
}

function checkPathItem(pathItem,openapi) {
	for (var o in pathItem) {
		var op = pathItem[o];
		if (o == 'parameters') {
			for (var param of pathItem.parameters) {
				checkParam(param,openapi);
			}
		}
		else if (o.startsWith('x-')) {
			// nop
		}
		else {	
			// check for description etc or that we are in get,put,post etc
			op.should.have.property('responses');
			op.responses.should.not.be.empty();
			op.should.not.have.property('consumes');
			op.should.not.have.property('produces');
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
	// TODO servers,server,variable,default
	openapi.should.have.key('paths');
    openapi.should.not.have.key('definitions');
    openapi.should.not.have.key('parameters');
    openapi.should.not.have.key('responses');
    openapi.should.not.have.key('securityDefinitions');
    openapi.should.not.have.key('produces');
    openapi.should.not.have.key('consumes');
	if (openapi.externalDocs) {
		openapi.externalDocs.should.have.key('url'); // and MUST be a URL
	}

    if (openapi.components && openapi.components.securitySchemes) {
        for (var s in openapi.components.securitySchemes) {
            var scheme = openapi.components.securitySchemes[s];
			scheme.should.have.property('type');
            scheme.type.should.not.be.exactly('basic');
			if (scheme.type == 'http') {
				scheme.should.have.property('scheme');
			}
			if (scheme.type == 'apiKey') {
				scheme.should.have.property('name');
				scheme.should.have.property('in');
			}
			if (scheme.type == 'oauth2') {
				scheme.should.have.property('flow');
				for (var f in scheme.flow) {
					var flow = scheme.flow[f];
					if ((f == 'implicit') || (f == 'authorizationCode')) {
						flow.should.have.property('authorizationUrl');	
					}
					if ((f == 'password') || (f == 'clientCredentials') ||
						(f == 'authorizationCode')) {
						flow.should.have.property('tokenUrl');
					}
					flow.should.have.property('scopes');
				}
			}
			if (scheme.type == 'openIdConnect') {
				scheme.should.have.property('openIdConnectUrl');
			}
        }
    }

    openapi.openapi.startsWith('3.0.').should.be.ok();

    common.recurse(openapi,{},function(obj,key,parent){
        if ((key === '$ref') && (typeof obj[key] === 'string')) {
            should(obj[key].indexOf('#/definitions/')).be.exactly(-1);
        }
    });

    if (openapi.components && openapi.components.parameters) {
        for (var p in openapi.components.parameters) {
            checkParam(openapi.components.parameters[p],openapi);
        }
    }
    for (var p in openapi.paths) {
        checkPathItem(openapi.paths[p],openapi);
    }
    if (openapi["x-ms-paths"]) {
        for (var p in openapi["x-ms-paths"]) {
            checkPathItem(openapi["x-ms-paths"][p],openapi);
        }
    }

    return true;
}

module.exports = {
    validate : validate
}
