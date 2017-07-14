// @ts-check
'use strict';

var fs = require('fs');
var url = require('url');
var URL = url.URL;
var util = require('util');

var yaml = require('js-yaml');
var should = require('should');
var ajv = require('ajv')({
	allErrors: true,
	verbose: true,
	jsonPointers: true,
	unknownFormats: 'ignore'
});

var jptr = require('jgexml/jpath.js');
var common = require('./common.js');

var jsonSchema = require('./schemas/json_v5.json');
var validateMetaSchema = ajv.compile(jsonSchema);
var openapi3Schema = require('./schemas/openapi-3.0.json');
var validateOpenAPI3 = ajv.compile(openapi3Schema);

function contextAppend(options,s) {
	options.context.push((options.context[options.context.length-1]+'/'+s).split('//').join('/'));
}

function validateUrl(s,contextServers,context,options) {
	if (!options.laxurls) s.should.not.be.exactly('','Invalid empty URL '+context);
	var base = options.origin||'http://localhost/';
	if (contextServers && contextServers.length) {
		let servers = contextServers[0];
		if (servers.length) {
			base = servers[0].url;
		}
	}
	if (s.indexOf('://')>0) { // FIXME HACK
		base = undefined;
	}
	var u = (URL && options.whatwg) ? new URL(s,base) : url.parse(s);
	return true; // if we haven't thrown
}

function validateComponentName(name) {
	return /^[a-zA-Z0-9\.\-_]+$/.test(name);
}

function validateHeaderName(name) {
	return /^[A-Za-z0-9!#\-\$%&'\*\+\\\.\^_`\|~]+$/.test(name);
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
		validateUrl(schema.externalDocs.url,[openapi.servers],'externalDocs',options).should.not.throw();
	}
	return !(errors && errors.length);
}

function checkContent(content,contextServers,openapi,options) {
	contextAppend(options,'content');
	for (let ct in content) {
		contextAppend(options,jptr.jpescape(ct));
		var contentType = content[ct];
		should(contentType).be.an.Object();
		should(contentType).not.be.an.Array();
		if (typeof contentType.schema !== 'undefined') {
			contentType.schema.should.be.an.Object();
			contentType.schema.should.not.be.an.Array();
		}
		if (contentType.example) {
			contentType.should.not.have.property('examples');
		}
		if (contentType.examples) {
			contextAppend(options,'examples');
			contentType.should.not.have.property('example');
			contentType.examples.should.be.an.Object();
			contentType.examples.should.not.be.an.Array();
			for (let ex in contentType.examples) {
				contentType.examples[ex].should.be.an.Object();
				contentType.examples[ex].should.not.be.an.Array();
				if (typeof contentType.examples[ex].summary !== 'undefined') {
					contentType.examples[ex].summary.should.have.type('string');
				}
				if (typeof contentType.examples[ex].description !== 'undefined') {
					contentType.examples[ex].description.should.have.type('string');
				}
				if (typeof contentType.examples[ex].value !== 'undefined') {
					contentType.examples[ex].should.not.have.property('externalValue');
				}
				if (typeof contentType.examples[ex].externalValue !== 'undefined') {
					contentType.examples[ex].externalValue.should.have.type('string');
					contentType.examples[ex].should.not.have.property('value');
					(function(){validateUrl(contentType.examples[ex].externalValue,contextServers,'examples..externalValue',options)}).should.not.throw();
				}

			}
			options.context.pop();
		}
		if (contentType.schema) validateSchema(contentType.schema,openapi,options);
		options.context.pop();
	}
	options.context.pop();
}

function checkServers(servers,options) {
	servers.should.be.an.Array();
	for (let server of servers) {
		server.should.have.property('url');
		(function(){validateUrl(server.url,[],'server.url',options)}).should.not.throw();
		if (server.variables) {
			for (let v in server.variables) {
				server.variables[v].should.have.key('default');
				server.variables[v].default.should.be.type('string');
				if (typeof server.variables[v].enum !== 'undefined') {
					server.variables[v].enum.should.be.an.Array();
					should(server.variables[v].enum.length).not.be.exactly(0,'Server variables enum should not be empty');
					for (let enumValue of server.variables[v].enum) {
						enumValue.should.be.type('string');
					}
				}
			}
		}
	}
}

function checkHeader(header,contextServers,openapi,options) {
	if (header.$ref) {
		var ref = header.$ref;
		should(Object.keys(header).length).be.exactly(1,'Reference object cannot be extended');
		header = common.resolveInternal(openapi,ref);
		should(header).not.be.exactly(false,'Could not resolve reference '+ref);
	}
	header.should.not.have.property('name');
	header.should.not.have.property('in');
	header.should.not.have.property('type');
	for (let prop of common.parameterTypeProperties) {
		header.should.not.have.property(prop);
	}
	if (header.schema) {
		header.should.not.have.property('content');
		if (typeof header.style !== 'undefined') {
			header.style.should.be.exactly('simple');
		}
		validateSchema(header.schema,openapi,options);
	}
	if (header.content) {
		header.should.not.have.property('schema');
		header.should.not.have.property('style');
		checkContent(header.content,contextServers,openapi,options);
	}
	if (!header.schema && !header.content) {
		header.should.have.property('schema','Header should have schema or content');
	}
}

function checkResponse(response,contextServers,openapi,options) {
	if (response.$ref) {
		var ref = response.$ref;
		should(Object.keys(response).length).be.exactly(1,'Reference object cannot be extended');
		response = common.resolveInternal(openapi,ref);
		should(response).not.be.exactly(false,'Could not resolve reference '+ref);
	}
	response.should.have.property('description');
	should(response.description).have.type('string','response description should be of type string');
	response.should.not.have.property('examples');
	if (typeof response.schema !== 'undefined') {
		response.schema.should.be.an.Object();
		response.schema.should.not.be.an.Array();
	}
	if (response.headers) {
		contextAppend(options,'headers');
		for (let h in response.headers) {
			contextAppend(options,h);
			validateHeaderName(h).should.be.equal(true,'Header doesn\'t match RFC7230 pattern');
			checkHeader(response.headers[h],contextServers,openapi,options);
			options.context.pop();
		}
		options.context.pop();
	}

	if (response.content) {
		checkContent(response.content,contextServers,openapi,options);
	}
}

function checkParam(param,index,contextServers,openapi,options){
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
	for (let prop of common.parameterTypeProperties) {
		param.should.not.have.property(prop);
	}
	param.in.should.not.be.exactly('body','Parameter type body is no-longer valid');
	param.in.should.not.be.exactly('formData','Parameter type formData is no-longer valid');
	if (param.description) {
		param.description.should.have.type('string');
	}
	if (param.schema) {
		param.should.not.have.property('content');
		if (typeof param.style !== 'undefined') {
			if (param.in == 'path') {
				param.style.should.not.be.exactly('form');
				param.style.should.not.be.exactly('spaceDelimited');
				param.style.should.not.be.exactly('pipeDelimited');
				param.style.should.not.be.exactly('deepObject');
			}
			if (param.in == 'query') {
				param.style.should.not.be.exactly('matrix');
				param.style.should.not.be.exactly('label');
				param.style.should.not.be.exactly('simple');
			}
			if (param.in == 'header') {
				param.style.should.be.exactly('simple');
			}
			if (param.in == 'cookie') {
				param.style.should.be.exactly('form');
			}
		}
		validateSchema(param.schema,openapi,options);
	}
	if (param.content) {
		param.should.not.have.property('schema');
		param.should.not.have.property('style');
		checkContent(param.content,contextServers,openapi,options);
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

	for (let o in pathItem) {
		contextAppend(options,o);
		var op = pathItem[o];
		if (o == 'parameters') {
			for (let p in pathItem.parameters) {
				checkParam(pathItem.parameters[p],p,contextServers,openapi,options);
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
			op.should.not.be.empty();
			op.should.not.have.property('consumes');
			op.should.not.have.property('produces');
			op.should.not.have.property('schemes');
			op.should.have.property('responses');
			op.responses.should.not.be.empty();
			if (op.summary) op.summary.should.have.type('string');
			if (op.description) op.description.should.have.type('string');

			if (op.servers) {
				checkServers(op.servers,options); // won't be here in converted definitions
				contextServers.push(op.servers);
			}

			if (op.requestBody && op.requestBody.content) {
				contextAppend(options,'requestBody');
				op.requestBody.should.have.property('content');
				if (typeof op.requestBody.description !== 'undefined') should(op.requestBody.description).have.type('string');
				if (typeof op.requestBody.required !== 'undefined') op.requestBody.required.should.have.type('boolean');
				checkContent(op.requestBody.content,contextServers,openapi,options);
				options.context.pop();
			}

			contextAppend(options,'responses');
			for (let r in op.responses) {
				contextAppend(options,r);
				var response = op.responses[r];
				checkResponse(response,contextServers,openapi,options);
				options.context.pop();
			}
			options.context.pop();

			if (op.parameters) {
				contextAppend(options,'parameters');
				for (let p in op.parameters) {
					checkParam(op.parameters[p],p,contextServers,openapi,options);
				}
				options.context.pop();
			}
			if (op.externalDocs) {
				op.externalDocs.should.have.key('url');
				op.externalDocs.url.should.have.type('string');
				(function(){validateUrl(op.externalDocs.url,contextServers,'externalDocs',options)}).should.not.throw();
			}
			if (op.callbacks) {
				contextAppend(options,'callbacks');
				for (let c in op.callbacks) {
					let callback = op.callbacks[c];
					if (!callback.$ref) {
						contextAppend(options,c);
						for (let p in callback) {
							let cbPi = callback[p];
							checkPathItem(cbPi,openapi,options);
						}
						options.context.pop();
					}
				}
				options.context.pop();
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

	if (options.jsonschema) {
		let schemaStr = fs.readFileSync(options.jsonschema,'utf8');
		openapi3Schema = yaml.safeLoad(schemaStr,{json:true});
		validateOpenAPI3 = ajv.compile(openapi3Schema);
	}

	options.context.push('#/');
    openapi.should.not.have.key('swagger');
	openapi.should.have.key('openapi');
	openapi.openapi.should.have.type('string');
	should.ok(openapi.openapi.startsWith('3.0.'),'Must be an OpenAPI 3.0.x document');
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
		(function(){validateUrl(openapi.info.termsOfService,contextServers,'termsOfService',options)}).should.not.throw();
	}
	options.context.pop();

	var contextServers = [];
	if (openapi.servers) {
		checkServers(openapi.servers,options);
		contextServers.push(openapi.servers);
	}
	if (openapi.externalDocs) {
		contextAppend(options,'externalDocs');
		openapi.externalDocs.should.have.key('url');
		openapi.externalDocs.url.should.have.type('string');
		(function(){validateUrl(openapi.externalDocs.url,contextServers,'externalDocs',options)}).should.not.throw();
		options.context.pop();
	}

	if (openapi.tags) {
		contextAppend(options,'tags');
		for (let tag of openapi.tags) {
			tag.should.have.property('name');
			tag.name.should.have.type('string');
			if (tag.externalDocs) {
				tag.externalDocs.should.have.key('url');
				tag.externalDocs.url.should.have.type('string');
				(function(){validateUrl(tag.externalDocs.url,contextServers,'tag.externalDocs',options)}).should.not.throw();
			}
		}
		options.context.pop();
	}

    if (openapi.components && openapi.components.securitySchemes) {
        for (let s in openapi.components.securitySchemes) {
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
				for (let f in scheme.flows) {
					var flow = scheme.flows[f];
					if ((f == 'implicit') || (f == 'authorizationCode')) {
						flow.should.have.property('authorizationUrl');
						flow.authorizationUrl.should.have.type('string');
						(function(){validateUrl(flow.authorizationUrl,contextServers,'authorizationUrl',options)}).should.not.throw();
					}
					else {
						flow.should.not.have.property('authorizationUrl');
					}
					if ((f == 'password') || (f == 'clientCredentials') ||
						(f == 'authorizationCode')) {
						flow.should.have.property('tokenUrl');
						flow.tokenUrl.should.have.type('string');
						(function(){validateUrl(flow.tokenUrl,contextServers,'tokenUrl',options)}).should.not.throw();
					}
					else {
						flow.should.not.have.property('tokenUrl');
					}
					if (typeof flow.refreshUrl !== 'undefined') {
						(function(){validateUrl(flow.refreshUrl,contextServers,'refreshUrl',options)}).should.not.throw();
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
				(function(){validateUrl(scheme.openIdConnectUrl,contextServers,'openIdConnectUrl',options)}).should.not.throw();
			}
			else {
				scheme.should.not.have.property('openIdConnectUrl');
			}
			options.context.pop();
        }
    }

    common.recurse(openapi,null,function(obj,key,state){
        if ((key === '$ref') && (typeof obj[key] === 'string')) {
			options.context.push(state.path);
            obj[key].should.not.startWith('#/definitions/');
			should(Object.keys(obj).length).be.exactly(1,'Reference object cannot be extended');
			var refUrl = url.parse(obj[key]);
			if (!refUrl.protocol && !refUrl.path) {
				should(jptr.jptr(openapi,obj[key])).not.be.exactly(false,'Cannot resolve reference: '+obj[key]);
			}
			options.context.pop();
        }
    });

    for (let p in openapi.paths) {
		options.context.push('#/paths/'+jptr.jpescape(p));
		if (!p.startsWith('x-')) {
			p.should.startWith('/');
			checkPathItem(openapi.paths[p],openapi,options);
		}
		options.context.pop();
    }
    if (openapi["x-ms-paths"]) {
        for (let p in openapi["x-ms-paths"]) {
			options.context.push('#/x-ms-paths/'+jptr.jpescape(p));
			p.should.startWith('/');
            checkPathItem(openapi["x-ms-paths"][p],openapi,options);
			options.context.pop();
        }
    }

    if (openapi.components && openapi.components.parameters) {
		options.context.push('#/components/parameters/');
        for (let p in openapi.components.parameters) {
            checkParam(openapi.components.parameters[p],p,contextServers,openapi,options);
			contextAppend(options, p);
			validateComponentName(p).should.be.equal(true,'component name invalid');
			options.context.pop();
        }
		options.context.pop();
    }

	if (openapi.components && openapi.components.schemas) {
		for (let s in openapi.components.schemas) {
			options.context.push('#/components/schemas/'+s);
			validateComponentName(s).should.be.equal(true,'component name invalid');
			validateSchema(openapi.components.schemas[s],openapi,options);
			options.context.pop();
		}
	}

	if (openapi.components && openapi.components.responses) {
		for (let r in openapi.components.responses) {
			options.context.push('#/components/responses/'+r);
			validateComponentName(r).should.be.equal(true,'component name invalid');
			checkResponse(openapi.components.responses[r],contextServers,openapi,options);
			options.context.pop();
		}
	}

	if (openapi.components && openapi.components.headers) {
		for (let h in openapi.components.headers) {
			options.context.push('#/components/headers/'+h);
			validateComponentName(h).should.be.equal(true,'component name invalid');
			checkHeader(openapi.components.headers[h],contextServers,openapi,options);
			options.context.pop();
		}
	}

	if (openapi.components && openapi.components.requestBodies) {
		for (let r in openapi.components.requestBodies) {
			options.context.push('#/components/requestBodies/'+r);
			validateComponentName(r).should.be.equal(true,'component name invalid');
			if (r.startsWith('requestBody')) {
				options.warnings.push('Anonymous requestBody: '+r);
			}
			let rb = openapi.components.requestBodies[r];
			rb.should.have.property('content');
			if (typeof rb.description !== 'undefined') should(rb.description).have.type('string');
			if (typeof rb.required !== 'undefined') rb.required.should.have.type('boolean');
			checkContent(rb.content,openapi.servers,openapi,options);
			options.context.pop();
		}
	}

	if (openapi.components && openapi.components.callbacks) {
		for (let c in openapi.components.callbacks) {
			options.context.push('#/components/callbacks/'+c);
			validateComponentName(c).should.be.equal(true,'component name invalid');
			let cb = openapi.components.callbacks[c];
			if (!cb.$ref) {
				for (let u in cb) {
					let cbPi = cb[u];
					checkPathItem(cbPi,openapi,options);
				}
			}
			options.context.pop();
		}
	}

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
