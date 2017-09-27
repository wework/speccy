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
    patternGroups: true,
    extendRefs: true // optional, current default is to 'fail', spec behaviour is to 'ignore'
});
//meta: false, // optional, to prevent adding draft-06 meta-schema

var ajvFormats = require('ajv/lib/compile/formats.js');
ajv.addFormat('uriref', ajvFormats.full['uri-reference']);
ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-04.json'));
ajv._refs['http://json-schema.org/schema'] = 'http://json-schema.org/draft-04/schema'; // optional, using unversioned URI is out of spec
var metaSchema = require('ajv/lib/refs/json-schema-v5.json');
ajv.addMetaSchema(metaSchema);
ajv._opts.defaultMeta = metaSchema.id;

var jptr = require('jgexml/jpath.js');
var common = require('./common.js');

var jsonSchema = require('./schemas/json_v5.json');
var validateMetaSchema = ajv.compile(jsonSchema);
var openapi3Schema = require('./schemas/openapi-3.0.json');
var validateOpenAPI3 = ajv.compile(openapi3Schema);

function contextAppend(options, s) {
    options.context.push((options.context[options.context.length - 1] + '/' + s).split('//').join('/'));
}

function validateUrl(s, contextServers, context, options) {
    if (!options.laxurls) s.should.not.be.exactly('', 'Invalid empty URL ' + context);
    var base = options.origin || 'http://localhost/';
    if (contextServers && contextServers.length) {
        let servers = contextServers[0];
        if (servers.length) {
            base = servers[0].url;
        }
    }
    if (s.indexOf('://') > 0) { // FIXME HACK
        base = undefined;
    }
    var u = (URL && options.whatwg) ? new URL(s, base) : url.parse(s);
    return true; // if we haven't thrown
}

function validateComponentName(name) {
    return /^[a-zA-Z0-9\.\-_]+$/.test(name);
}

function validateHeaderName(name) {
    return /^[A-Za-z0-9!#\-\$%&'\*\+\\\.\^_`\|~]+$/.test(name);
}

function validateSchema(schema, openapi, options) {
    validateMetaSchema(schema);
    var errors = validateSchema.errors;
    if (errors && errors.length) {
        throw (new Error('Schema invalid: ' + util.inspect(errors)));
    }
    if (schema.externalDocs) {
        schema.externalDocs.should.have.key('url');
        schema.externalDocs.url.should.have.type('string');
        validateUrl(schema.externalDocs.url, [openapi.servers], 'externalDocs', options).should.not.throw();
    }
    return !(errors && errors.length);
}

function checkExample(ex, openapi, options) {
    ex.should.be.an.Object();
    ex.should.not.be.an.Array();
    if (typeof ex.summary !== 'undefined') {
        ex.summary.should.have.type('string');
    }
    if (typeof ex.description !== 'undefined') {
        ex.description.should.have.type('string');
    }
    if (typeof ex.value !== 'undefined') {
        ex.should.not.have.property('externalValue');
    }
    //else { // not mandated by the spec.
    //    ex.should.have.property('externalValue');
    //}
    if (typeof ex.externalValue !== 'undefined') {
        ex.externalValue.should.have.type('string');
        ex.should.not.have.property('value');
        (function () { validateUrl(ex.externalValue, contextServers, 'examples..externalValue', options) }).should.not.throw();
    }
    //else { // not mandated by the spec.
    //    ex.should.have.property('value');
    //}
    for (let k in ex) {
        if (!k.startsWith('x-')) {
            should(['summary','description','value','externalValue'].indexOf(k)).be.greaterThan(-1,'Example object cannot have additionalField: '+k);
        }
    }
}

function checkContent(content, contextServers, openapi, options) {
    contextAppend(options, 'content');
    for (let ct in content) {
        contextAppend(options, jptr.jpescape(ct));
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
            contextAppend(options, 'examples');
            contentType.should.not.have.property('example');
            contentType.examples.should.be.an.Object();
            contentType.examples.should.not.be.an.Array();
            for (let e in contentType.examples) {
                let ex = contentType.examples[e];
                if (!ex.$ref) {
                    checkExample(ex, openapi, options);
                }
            }
            options.context.pop();
        }
        if (contentType.schema) validateSchema(contentType.schema, openapi, options);
        options.context.pop();
    }
    options.context.pop();
}

function checkServer(server, options) {
    server.should.have.property('url');
    (function () { validateUrl(server.url, [], 'server.url', options) }).should.not.throw();
    let srvVars = 0;
    server.url.replace(/\{(.+?)\}/g, function (match, group1) {
        srvVars++;
        server.should.have.key('variables');
        server.variables.should.have.key(group1);
    });
    if (server.variables) {
        contextAppend(options, 'variables');
        for (let v in server.variables) {
            contextAppend(options, v);
            server.variables[v].should.have.key('default');
            server.variables[v].default.should.be.type('string');
            if (typeof server.variables[v].enum !== 'undefined') {
                contextAppend(options, 'enum');
                server.variables[v].enum.should.be.an.Array();
                should(server.variables[v].enum.length).not.be.exactly(0, 'Server variables enum should not be empty');
                for (let e in server.variables[v].enum) {
                    contextAppend(options, e);
                    server.variables[v].enum[e].should.be.type('string');
                    options.context.pop();
                }
                options.context.pop();
            }
            options.context.pop();
        }
        should(Object.keys(server.variables).length).be.exactly(srvVars);
        options.context.pop();
    }
}

function checkServers(servers, options) {
    servers.should.be.an.Array();
    for (let s in servers) {
        contextAppend(options, s);
        let server = servers[s];
        checkServer(server, options);
        options.context.pop();
    }
}

function checkLink(link, options) {
    link.should.be.type('object');
    if (typeof link.operationRef !== 'undefined') {
        link.operationRef.should.be.type('string');
        link.should.not.have.property('operationId');
    }
    else {
        link.should.have.property('operationId');
    }
    if (typeof link.operationId !== 'undefined') {
        link.operationId.should.be.type('string');
        link.should.not.have.property('operationRef');
        // validate operationId exists (external refs?)
    }
    else {
        link.should.have.property('operationdRef');
    }
    if (typeof link.parameters != 'undefined') {
        link.parameters.should.be.type('object');
        link.parameters.should.not.be.an.Array();
    }
    if (typeof link.description !== 'undefined') {
        link.description.should.have.type('string');
    }
    if (typeof link.server !== 'undefined') {
        checkServer(link.server, options);
    }
}

function checkHeader(header, contextServers, openapi, options) {
    if (header.$ref) {
        var ref = header.$ref;
        if (!options.laxRefs) should(Object.keys(header).length).be.exactly(1, 'Reference object cannot be extended');
        header = common.resolveInternal(openapi, ref);
        should(header).not.be.exactly(false, 'Could not resolve reference ' + ref);
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
            header.style.should.be.type('string');
            header.style.should.be.exactly('simple');
        }
        if (typeof header.explode !== 'undefined') {
            header.explode.should.be.type('boolean');
        }
        if (typeof header.allowReserved !== 'undefined') {
            header.allowReserved.should.be.type('boolean');
        }
        validateSchema(header.schema, openapi, options);
    }
    if (header.content) {
        header.should.not.have.property('schema');
        header.should.not.have.property('style');
        header.should.not.have.property('explode');
        header.should.not.have.property('allowReserved');
        header.should.not.have.property('example');
        header.should.not.have.property('examples');
        checkContent(header.content, contextServers, openapi, options);
    }
    if (!header.schema && !header.content) {
        header.should.have.property('schema', 'Header should have schema or content');
    }
}

function checkResponse(response, contextServers, openapi, options) {
    if (response.$ref) {
        var ref = response.$ref;
        if (!options.laxRefs) should(Object.keys(response).length).be.exactly(1, 'Reference object cannot be extended');
        response = common.resolveInternal(openapi, ref);
        should(response).not.be.exactly(false, 'Could not resolve reference ' + ref);
    }
    response.should.have.property('description');
    should(response.description).have.type('string', 'response description should be of type string');
    response.should.not.have.property('examples');
    if (typeof response.schema !== 'undefined') {
        response.schema.should.be.an.Object();
        response.schema.should.not.be.an.Array();
    }
    if (response.headers) {
        contextAppend(options, 'headers');
        for (let h in response.headers) {
            contextAppend(options, h);
            validateHeaderName(h).should.be.equal(true, 'Header doesn\'t match RFC7230 pattern');
            checkHeader(response.headers[h], contextServers, openapi, options);
            options.context.pop();
        }
        options.context.pop();
    }

    if (response.content) {
        checkContent(response.content, contextServers, openapi, options);
    }

    if (typeof response.links !== 'undefined') {
        contextAppend(options, 'links');
        for (let l in response.links) {
            contextAppend(options, l);
            checkLink(response.links[l], options);
            options.context.pop();
        }
        options.context.pop();
    }
}

function checkParam(param, index, contextServers, openapi, options) {
    contextAppend(options, index);
    if (param.$ref) {
        if (!options.laxRefs) should(Object.keys(param).length).be.exactly(1, 'Reference object cannot be extended');
        var ref = param.$ref;
        param = common.resolveInternal(openapi, ref);
        should(param).not.be.exactly(false, 'Could not resolve reference ' + ref);
    }
    param.should.have.property('name');
    param.name.should.have.type('string');
    param.should.have.property('in');
    param.in.should.have.type('string');
    param.in.should.equalOneOf('query', 'header', 'path', 'cookie');
    if (param.in == 'path') {
        param.should.have.property('required');
        param.required.should.be.exactly(true, 'Path parameters must have an explicit required:true');
    }
    if (typeof param.required !== 'undefined') should(param.required).have.type('boolean');
    param.should.not.have.property('items');
    param.should.not.have.property('collectionFormat');
    param.should.not.have.property('type');
    for (let prop of common.parameterTypeProperties) {
        param.should.not.have.property(prop);
    }
    param.in.should.not.be.exactly('body', 'Parameter type body is no-longer valid');
    param.in.should.not.be.exactly('formData', 'Parameter type formData is no-longer valid');
    if (param.description) {
        param.description.should.have.type('string');
    }
    if (param.schema) {
        param.should.not.have.property('content');
        if (typeof param.style !== 'undefined') {
            param.style.should.be.type('string');
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
        if (typeof param.explode !== 'undefined') {
            param.explode.should.be.type('boolean');
        }
        if (typeof param.allowReserved !== 'undefined') {
            param.allowReserved.should.be.type('boolean');
        }
        validateSchema(param.schema, openapi, options);
    }
    if (param.content) {
        param.should.not.have.property('schema');
        param.should.not.have.property('style');
        param.should.not.have.property('explode');
        param.should.not.have.property('allowReserved');
        param.should.not.have.property('example');
        param.should.not.have.property('examples');
        should(Object.keys(param.content).length).be.exactly(1, 'Parameter content must have only one entry');
        checkContent(param.content, contextServers, openapi, options);
    }
    if (!param.schema && !param.content) {
        param.should.have.property('schema', 'Parameter should have schema or content');
    }
    options.context.pop();
    return true;
}

function checkPathItem(pathItem, openapi, options) {

    var contextServers = [];
    contextServers.push(openapi.servers);
    if (pathItem.servers) contextServers.push(pathItem.servers);

    for (let o in pathItem) {
        contextAppend(options, o);
        var op = pathItem[o];
        if (o == 'parameters') {
            for (let p in pathItem.parameters) {
                checkParam(pathItem.parameters[p], p, contextServers, openapi, options);
            }
        }
        else if (o == 'servers') {
            contextAppend(options, 'servers');
            checkServers(op, options); // won't be here in converted definitions
            options.context.pop();
        }
        else if (o == 'summary') {
            pathItem.summary.should.have.type('string');
        }
        else if (o == 'description') {
            pathItem.description.should.have.type('string');
        }
        else if (common.httpVerbs.indexOf(o) >= 0) {
            op.should.not.be.empty();
            op.should.not.have.property('consumes');
            op.should.not.have.property('produces');
            op.should.not.have.property('schemes');
            op.should.have.property('responses');
            op.responses.should.not.be.empty();
            if (op.summary) op.summary.should.have.type('string');
            if (op.description) op.description.should.have.type('string');

            if (op.servers) {
                contextAppend(options, 'servers');
                checkServers(op.servers, options); // won't be here in converted definitions
                options.context.pop();
                contextServers.push(op.servers);
            }

            if (op.requestBody && op.requestBody.content) {
                contextAppend(options, 'requestBody');
                op.requestBody.should.have.property('content');
                if (typeof op.requestBody.description !== 'undefined') should(op.requestBody.description).have.type('string');
                if (typeof op.requestBody.required !== 'undefined') op.requestBody.required.should.have.type('boolean');
                checkContent(op.requestBody.content, contextServers, openapi, options);
                options.context.pop();
            }

            contextAppend(options, 'responses');
            for (let r in op.responses) {
                contextAppend(options, r);
                var response = op.responses[r];
                checkResponse(response, contextServers, openapi, options);
                options.context.pop();
            }
            options.context.pop();

            if (op.parameters) {
                contextAppend(options, 'parameters');
                for (let p in op.parameters) {
                    checkParam(op.parameters[p], p, contextServers, openapi, options);
                }
                options.context.pop();
            }
            if (op.externalDocs) {
                contextAppend(options, 'externalDocs');
                op.externalDocs.should.have.key('url');
                op.externalDocs.url.should.have.type('string');
                (function () { validateUrl(op.externalDocs.url, contextServers, 'externalDocs', options) }).should.not.throw();
                options.context.pop();
            }
            if (op.callbacks) {
                contextAppend(options, 'callbacks');
                for (let c in op.callbacks) {
                    let callback = op.callbacks[c];
                    if (!callback.$ref) {
                        contextAppend(options, c);
                        for (let p in callback) {
                            let cbPi = callback[p];
                            checkPathItem(cbPi, openapi, options);
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
        let schemaStr = fs.readFileSync(options.jsonschema, 'utf8');
        openapi3Schema = yaml.safeLoad(schemaStr, { json: true });
        validateOpenAPI3 = ajv.compile(openapi3Schema);
    }

    options.context.push('#/');
    openapi.should.not.have.key('swagger');
    openapi.should.have.key('openapi');
    openapi.openapi.should.have.type('string');
    should.ok(openapi.openapi.startsWith('3.0.'), 'Must be an OpenAPI 3.0.x document');
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
    contextAppend(options, 'info');
    openapi.info.should.have.key('title');
    should(openapi.info.title).be.type('string', 'title should be of type string');
    openapi.info.should.have.key('version');
    should(openapi.info.version).be.type('string', 'version should be of type string');
    if (openapi.info.license) {
        contextAppend(options, 'license');
        openapi.info.license.should.have.key('name');
        openapi.info.license.name.should.have.type('string');
        options.context.pop();
    }
    if (typeof openapi.info.termsOfService !== 'undefined') {
        should(openapi.info.termsOfService).not.be.Null();
        (function () { validateUrl(openapi.info.termsOfService, contextServers, 'termsOfService', options) }).should.not.throw();
    }
    options.context.pop();

    var contextServers = [];
    if (openapi.servers) {
        contextAppend(options, 'servers');
        checkServers(openapi.servers, options);
        options.context.pop();
        contextServers.push(openapi.servers);
    }
    if (openapi.externalDocs) {
        contextAppend(options, 'externalDocs');
        openapi.externalDocs.should.have.key('url');
        openapi.externalDocs.url.should.have.type('string');
        (function () { validateUrl(openapi.externalDocs.url, contextServers, 'externalDocs', options) }).should.not.throw();
        options.context.pop();
    }

    if (openapi.tags) {
        contextAppend(options, 'tags');
        for (let tag of openapi.tags) {
            tag.should.have.property('name');
            tag.name.should.have.type('string');
            if (tag.externalDocs) {
                tag.externalDocs.should.have.key('url');
                tag.externalDocs.url.should.have.type('string');
                (function () { validateUrl(tag.externalDocs.url, contextServers, 'tag.externalDocs', options) }).should.not.throw();
            }
        }
        options.context.pop();
    }

    if (openapi.components && openapi.components.securitySchemes) {
        for (let s in openapi.components.securitySchemes) {
            options.context.push('#/components/securitySchemes/' + s);
            validateComponentName(s).should.be.equal(true, 'component name invalid');
            var scheme = openapi.components.securitySchemes[s];
            scheme.should.have.property('type');
            scheme.type.should.have.type('string');
            scheme.type.should.not.be.exactly('basic', 'Security scheme basic should be http with scheme basic');
            scheme.type.should.equalOneOf('apiKey', 'http', 'oauth2', 'openIdConnect');
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
                scheme.in.should.equalOneOf('query', 'header');
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
                        (function () { validateUrl(flow.authorizationUrl, contextServers, 'authorizationUrl', options) }).should.not.throw();
                    }
                    else {
                        flow.should.not.have.property('authorizationUrl');
                    }
                    if ((f == 'password') || (f == 'clientCredentials') ||
                        (f == 'authorizationCode')) {
                        flow.should.have.property('tokenUrl');
                        flow.tokenUrl.should.have.type('string');
                        (function () { validateUrl(flow.tokenUrl, contextServers, 'tokenUrl', options) }).should.not.throw();
                    }
                    else {
                        flow.should.not.have.property('tokenUrl');
                    }
                    if (typeof flow.refreshUrl !== 'undefined') {
                        (function () { validateUrl(flow.refreshUrl, contextServers, 'refreshUrl', options) }).should.not.throw();
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
                (function () { validateUrl(scheme.openIdConnectUrl, contextServers, 'openIdConnectUrl', options) }).should.not.throw();
            }
            else {
                scheme.should.not.have.property('openIdConnectUrl');
            }
            options.context.pop();
        }
    }

    common.recurse(openapi, null, function (obj, key, state) {
        if ((key === '$ref') && (typeof obj[key] === 'string')) {
            options.context.push(state.path);
            obj[key].should.not.startWith('#/definitions/');
            if (!options.laxRefs) should(Object.keys(obj).length).be.exactly(1, 'Reference object cannot be extended');
            var refUrl = url.parse(obj[key]);
            if (!refUrl.protocol && !refUrl.path) {
                should(jptr.jptr(openapi, obj[key])).not.be.exactly(false, 'Cannot resolve reference: ' + obj[key]);
            }
            options.context.pop();
        }
    });

    for (let p in openapi.paths) {
        options.context.push('#/paths/' + jptr.jpescape(p));
        if (!p.startsWith('x-')) {
            p.should.startWith('/');
            checkPathItem(openapi.paths[p], openapi, options);
        }
        options.context.pop();
    }
    if (openapi["x-ms-paths"]) {
        for (let p in openapi["x-ms-paths"]) {
            options.context.push('#/x-ms-paths/' + jptr.jpescape(p));
            p.should.startWith('/');
            checkPathItem(openapi["x-ms-paths"][p], openapi, options);
            options.context.pop();
        }
    }

    if (openapi.components && openapi.components.parameters) {
        options.context.push('#/components/parameters/');
        for (let p in openapi.components.parameters) {
            checkParam(openapi.components.parameters[p], p, contextServers, openapi, options);
            contextAppend(options, p);
            validateComponentName(p).should.be.equal(true, 'component name invalid');
            options.context.pop();
        }
        options.context.pop();
    }

    if (openapi.components && openapi.components.schemas) {
        options.context.push('#/components/schemas');
        openapi.components.schemas.should.be.type('object');
        openapi.components.schemas.should.not.be.an.Array();
        for (let s in openapi.components.schemas) {
            options.context.push('#/components/schemas/' + s);
            validateComponentName(s).should.be.equal(true, 'component name invalid');
            validateSchema(openapi.components.schemas[s], openapi, options);
            options.context.pop();
        }
        options.context.pop();
    }

    if (openapi.components && openapi.components.responses) {
        options.context.push('#/components/responses');
        openapi.components.responses.should.be.type('object');
        openapi.components.responses.should.not.be.an.Array();
        for (let r in openapi.components.responses) {
            options.context.push('#/components/responses/' + r);
            validateComponentName(r).should.be.equal(true, 'component name invalid');
            checkResponse(openapi.components.responses[r], contextServers, openapi, options);
            options.context.pop();
        }
        options.context.pop();
    }

    if (openapi.components && openapi.components.headers) {
        options.context.push('#/components/headers');
        openapi.components.headers.should.be.type('object');
        openapi.components.headers.should.not.be.an.Array();
        for (let h in openapi.components.headers) {
            options.context.push('#/components/headers/' + h);
            validateComponentName(h).should.be.equal(true, 'component name invalid');
            checkHeader(openapi.components.headers[h], contextServers, openapi, options);
            options.context.pop();
        }
        options.context.pop();
    }

    if (openapi.components && openapi.components.requestBodies) {
        options.context.push('#/components/requestBodies');
        openapi.components.requestBodies.should.be.type('object');
        openapi.components.requestBodies.should.not.be.an.Array();
        for (let r in openapi.components.requestBodies) {
            options.context.push('#/components/requestBodies/' + r);
            validateComponentName(r).should.be.equal(true, 'component name invalid');
            if (r.startsWith('requestBody')) {
                options.warnings.push('Anonymous requestBody: ' + r);
            }
            let rb = openapi.components.requestBodies[r];
            rb.should.have.property('content');
            if (typeof rb.description !== 'undefined') should(rb.description).have.type('string');
            if (typeof rb.required !== 'undefined') rb.required.should.have.type('boolean');
            checkContent(rb.content, openapi.servers, openapi, options);
            options.context.pop();
        }
        options.context.pop();
    }

    if (openapi.components && openapi.components.examples) {
        options.context.push('#/components/examples');
        openapi.components.examples.should.be.type('object');
        openapi.components.examples.should.not.be.an.Array();
        for (let e in openapi.components.examples) {
            options.context.push('#/components/examples/' + e);
            validateComponentName(e).should.be.equal(true, 'component name invalid');
            let ex = openapi.components.examples[e];
            if (!ex.$ref) {
               checkExample(ex, openapi, options);
            }
        }
        options.context.pop();
    }

    if (openapi.components && openapi.components.callbacks) {
        options.context.push('#/components/callbacks');
        openapi.components.callbacks.should.be.type('object');
        openapi.components.callbacks.should.not.be.an.Array();
        for (let c in openapi.components.callbacks) {
            options.context.push('#/components/callbacks/' + c);
            validateComponentName(c).should.be.equal(true, 'component name invalid');
            let cb = openapi.components.callbacks[c];
            if (!cb.$ref) {
                for (let u in cb) {
                    let cbPi = cb[u];
                    checkPathItem(cbPi, openapi, options);
                }
            }
            options.context.pop();
        }
        options.context.pop();
    }

    if (openapi.components && openapi.components.links) {
        options.context.push('#/components/links');
        openapi.components.links.should.be.type('object');
        openapi.components.links.should.not.be.an.Array();
        for (let l in openapi.components.links) {
            options.context.push('#/components/links/' + l);
            validateComponentName(l).should.be.equal(true, 'component name invalid');
            let link = openapi.components.links[l];
            if (!link.$ref) {
                checkLink(link, options);
            }
            options.context.pop();
        }
        options.context.pop();
    }

    validateOpenAPI3(openapi);
    var errors = validateOpenAPI3.errors;
    if (errors && errors.length) {
        throw (new Error('Failed OpenAPI3 schema validation: ' + JSON.stringify(errors, null, 2)));
    }

    options.valid = !options.expectFailure;
    if (callback) callback(null, options);
    return options.valid;
}

function validate(openapi, options, callback) {
    process.nextTick(function () {
        validateSync(openapi, options, callback);
    });
}

module.exports = {
    validateSync: validateSync,
    validate: validate
}
