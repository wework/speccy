// @ts-check

'use strict';

const url = require('url');
const URL = url.URL;
const should = require('should');
const co = require('co');
const ajv = require('ajv')({
    allErrors: true,
    verbose: true,
    jsonPointers: true,
    patternGroups: true,
    extendRefs: true // optional, current default is to 'fail', spec behaviour is to 'ignore'
});
//meta: false, // optional, to prevent adding draft-06 meta-schema

const common = require('./common.js');
const jptr = require('reftools/lib/jptr.js');
const walkSchema = require('./walkSchema.js').walkSchema;
const wsGetDefaultState = require('./walkSchema.js').getDefaultState;
const linter = require('./linter.js');

setupAjv(ajv);

const jsonSchema = require('../schemas/json_v5.json');
const validateMetaSchema = ajv.compile(jsonSchema);
const openapi3Schema = require('../schemas/openapi-3.0.json');
const validateOpenAPI3 = ajv.compile(openapi3Schema);

const dummySchema = { anyOf: {} };
const emptySchema = {};

class JSONSchemaError extends Error {
    constructor(message, params) {
        super(message);
        this.errors = params.errors;
    }
}

function setupAjv(ajv) {
    const ajvFormats = require('ajv/lib/compile/formats.js');
    ajv.addFormat('uriref', ajvFormats.full['uri-reference']);
    ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-04.json'));
    ajv._refs['http://json-schema.org/schema'] = 'http://json-schema.org/draft-04/schema'; // optional, using unversioned URI is out of spec
    const metaSchema = require('ajv/lib/refs/json-schema-v5.json');
    ajv.addMetaSchema(metaSchema);
    ajv._opts.defaultMeta = metaSchema.id;
}

function contextAppend(options, s) {
    options.context.push((options.context[options.context.length - 1] + '/' + s).split('//').join('/'));
}

function validateUrl(s, contextServers, context, options) {
    s.should.be.a.String().and.not.be.Null();
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
    return !(errors && errors.length);
}

function checkSubSchema(schema, parent, state) {
    let prop = state.property;
    if (prop) contextAppend(state.options, prop);
    state.options.linter('schema', schema, state.options);
    schema.should.be.an.Object();

    if (typeof schema.$ref !== 'undefined') {
        schema.$ref.should.be.a.String();
        state.options.linter('reference',schema,state.options);
        if (prop) state.options.context.pop();
        return; // all other properties SHALL be ignored
    }

    for (let k in schema) {
        if (!k.startsWith('x-')) {
            should(['type','items','format','properties','required','minimum','maximum',
            'exclusiveMinimum','exclusiveMaximum','enum','default','description','title',
            'readOnly','writeOnly','anyOf','allOf','oneOf','not','discriminator','maxItems',
            'minItems','additionalItems','additionalProperties','example','maxLength',
            'minLength','pattern','uniqueItems','xml','externalDocs','nullable','deprecated',
            'minProperties','maxProperties','multipleOf'].indexOf(k))
            .be.greaterThan(-1,'Schema object cannot have additionalProperty: '+k);
        }
    }

    if (schema.multipleOf) {
        schema.multipleOf.should.be.a.Number();
        schema.multipleOf.should.be.greaterThan(0);
    }
    if (schema.maximum) {
        schema.maximum.should.be.a.Number();
    }
    if (schema.exclusiveMaximum) {
        schema.exclusiveMaximum.should.be.a.Boolean();
    }
    if (schema.minimum) {
        schema.minimum.should.be.a.Number();
    }
    if (schema.exclusiveMinimum) {
        schema.exclusiveMinimum.should.be.a.Boolean();
    }
    if (schema.maxLength) {
        schema.maxLength.should.be.a.Number();
        schema.maxLength.should.be.greaterThan(-1);
    }
    if (schema.minLength) {
        schema.minLength.should.be.a.Number();
        schema.minLength.should.be.greaterThan(-1);
    }
    if (schema.pattern) {
        try {
            const _ = new RegExp(schema.pattern);
        }
        catch (ex) {
            should.fail(false,true,'pattern does not conform to ECMA-262');
        }
    }
    if (typeof schema.items !== 'undefined') {
        schema.items.should.be.an.Object();
        schema.items.should.not.be.an.Array();
    }
    if (schema.additionalItems) {
        if (typeof schema.additionalItems === 'boolean') {
        }
        else if (typeof schema.additionalItems === 'object') {
            schema.additionalItems.should.not.be.an.Array();
        }
        else should.fail(false,true,'additionalItems must be a boolean or schema');
    }
    if (schema.additionalProperties) {
        if (typeof schema.additionalProperties === 'boolean') {
        }
        else if (typeof schema.additionalProperties === 'object') {
            schema.additionalProperties.should.not.be.an.Array();
        }
        else should.fail(false,true,'additionalProperties must be a boolean or schema');
    }
    if (schema.maxItems) {
        schema.maxItems.should.be.a.Number();
        schema.maxItems.should.be.greaterThan(-1);
    }
    if (schema.minItems) {
        schema.minItems.should.be.a.Number();
        schema.minItems.should.be.greaterThan(-1);
    }
    if (typeof schema.uniqueItems !== 'undefined') {
        schema.uniqueItems.should.be.a.Boolean();
    }
    if (schema.maxProperties) {
        schema.maxProperties.should.be.a.Number();
        schema.maxProperties.should.be.greaterThan(-1);
    }
    if (schema.minProperties) {
        schema.minProperties.should.be.a.Number();
        schema.minProperties.should.be.greaterThan(-1);
    }
    if (typeof schema.required !== 'undefined') {
        schema.required.should.be.an.Array();
        schema.required.should.not.be.empty();
        common.hasDuplicates(schema.required).should.be.exactly(false,'required items must be unique');
    }
    if (schema.properties) {
        schema.properties.should.be.an.Object();
    }
    schema.should.not.have.property('patternProperties');

    /*if (schema.patternProperties) {
        schema.patternProperties.should.be.an.Object();
        for (let prop in schema.patternProperties) {
            try {
                let regex = new RegExp(prop);
            }
            catch (ex) {
                should.fail(false,true,'patternProperty '+prop+' does not conform to ECMA-262');
            }
        }
    }*/
    if (typeof schema.enum !== 'undefined') {
        schema.enum.should.be.an.Array();
        schema.enum.should.not.be.empty();
        // items only SHOULD be unique
    }
    if (typeof schema.type !== 'undefined') {
        schema.type.should.be.a.String(); // not an array
        schema.type.should.equalOneOf('integer','number','string','boolean','object','array'); // not null
        if (schema.type === 'array') {
            schema.should.have.property('items');
        }
    }
    if (schema.allOf) {
        schema.allOf.should.be.an.Array();
        schema.allOf.should.not.be.empty();
    }
    if (schema.anyOf) {
        schema.anyOf.should.be.an.Array();
        schema.anyOf.should.not.be.empty();
    }
    if (schema.oneOf) {
        schema.oneOf.should.be.an.Array();
        schema.oneOf.should.not.be.empty();
    }
    if (schema.not) {
        schema.not.should.be.an.Object();
    }
    if (typeof schema.title !== 'undefined') {
        schema.title.should.be.a.String(); //?
    }
    if (typeof schema.description !== 'undefined') {
        schema.description.should.be.a.String();
    }
    if (typeof schema.default !== 'undefined') {
        schema.should.have.property('type');
        let realType = typeof schema.default;
        let schemaType = schema.type;
        if (Array.isArray(schema.default)) realType = 'array';
        if (schemaType === 'integer') schemaType = 'number';
        schemaType.should.equal(realType);
    }
    if (typeof schema.format !== 'undefined') {
        schema.format.should.be.a.String();
        if (schema.type && ['date-time','email','hostname','ipv4','ipv6','uri','uriref',
            'byte','binary','date','password'].indexOf(schema.format) >= 0) {
            schema.type.should.equal('string');
        }
        if (schema.type && ['int32','int64'].indexOf(schema.format) >= 0) {
            if (schema.type !== 'string' && schema.type !== 'number') { // common case - googleapis
               schema.type.should.equal('integer');
            }
        }
        if (schema.type && ['float','double'].indexOf(schema.format) >= 0) {
            if (schema.type !== 'string') { // occasionally seen
                schema.type.should.equal('number');
            }
        }
    }

    if (typeof schema.nullable !== 'undefined') {
        schema.nullable.should.be.a.Boolean();
    }
    if (typeof schema.readOnly !== 'undefined') {
        schema.readOnly.should.be.a.Boolean();
        schema.should.not.have.property('writeOnly');
    }
    if (typeof schema.writeOnly !== 'undefined') {
        schema.writeOnly.should.be.a.Boolean();
        schema.should.not.have.property('readOnly');
    }
    if (typeof schema.deprecated !== 'undefined') {
        schema.deprecated.should.be.a.Boolean();
    }
    if (typeof schema.discriminator !== 'undefined') {
        schema.discriminator.should.be.an.Object();
        schema.discriminator.should.have.property('propertyName');
        //"To avoid redundancy, the discriminator MAY be added to a parent schema definition..."
        //if ((Object.keys(parent).length>0) && !(parent.oneOf || parent.anyOf || parent.allOf)) {
        //    should.fail(false,true,'discriminator requires oneOf, anyOf or allOf in parent schema');
        //}
    }
    if (typeof schema.xml !== 'undefined') {
        schema.xml.should.be.an.Object();
    }
    // example can be any type

    if (schema.externalDocs) {
        schema.externalDocs.should.have.key('url');
        should.doesNotThrow(function() {
 validateUrl(schema.externalDocs.url, [state.openapi.servers], 'externalDocs', state.options)
}, 'Invalid externalDocs.url');
    }
    if (prop) state.options.context.pop();
    if (!prop || prop === 'schema') validateSchema(schema, state.openapi, state.options); // top level only
}

function checkSchema(schema,parent,prop,openapi,options) {
    const state = Object.assign({}, wsGetDefaultState(), {
      openapi,
      options,
      property: prop,
    });
    walkSchema(schema,parent,state,checkSubSchema);
}

function checkExample(ex, contextServers, openapi, options) {
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
    //else { // not mandated by the spec. moved to linter rule
    //    ex.should.have.property('externalValue');
    //}
    if (typeof ex.externalValue !== 'undefined') {
        ex.should.not.have.property('value');
        should.doesNotThrow(function () {
            validateUrl(ex.externalValue, contextServers, 'examples..externalValue', options);
        },'Invalid examples..externalValue');
    }
    //else { // not mandated by the spec. moved to linter rule
    //    ex.should.have.property('value');
    //}
    for (let k in ex) {
        if (!k.startsWith('x-')) {
            should(['summary','description','value','externalValue'].indexOf(k)).be.greaterThan(-1,'Example object cannot have additionalProperty: '+k);
        }
    }
    options.linter('example',ex,options);
}

function checkContent(content, contextServers, openapi, options) {
    contextAppend(options, 'content');
    for (let ct in content) {
        contextAppend(options, jptr.jpescape(ct));
        // validate ct against https://tools.ietf.org/html/rfc6838#section-4.2
        should(/[a-zA-Z0-9!#$%^&\*_\-\+{}\|'.`~]+\/[a-zA-Z0-9!#$%^&\*_\-\+{}\|'.`~]+/.test(ct)).be.exactly(true,'media-type should match RFC6838 format'); // this is a SHOULD not MUST
        var contentType = content[ct];
        should(contentType).be.an.Object();
        should(contentType).not.be.an.Array();
        if (typeof contentType.schema !== 'undefined') {
            contentType.schema.should.be.an.Object();
            contentType.schema.should.not.be.an.Array();
            checkSchema(contentType.schema,{},'schema',openapi,options);
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
                if (ex.$ref) {
                    options.linter('reference',ex,options);
                }
                else {
                    checkExample(ex, contextServers, openapi, options);
                }
            }
            options.context.pop();
        }
        if (typeof contentType.schema !== 'undefined') {
            checkSchema(contentType.schema, emptySchema, 'schema', openapi, options);
        }
        options.context.pop();
    }
    options.context.pop();
}

function checkServer(server, options) {
    server.should.have.property('url');
    should.doesNotThrow(function () {
 validateUrl(server.url, [], 'server.url', options)
},'Invalid server.url');
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
            options.linter('serverVariable',server.variables[v],options);
            options.context.pop();
        }
        should(Object.keys(server.variables).length).be.exactly(srvVars);
        options.context.pop();
    }
    options.linter('server',server,options);
}

function checkServers(servers, options) {
    servers.should.be.an.Array();
    for (const s in servers) {
        contextAppend(options, s);
        const server = servers[s];
        checkServer(server, options);
        options.context.pop();
    }
}

function checkLink(link, openapi, options) {
    if (link.$ref) {
        let ref = link.$ref;
        should(link.$ref).be.type('string');
        if (options.lint) options.linter('reference',link,'$ref',options);
        link = common.resolveInternal(openapi, ref);
        should(link).not.be.exactly(false, 'Cannot resolve reference: ' + ref);
    }
    link.should.be.type('object');
    if (typeof link.operationRef === 'undefined') {
        link.should.have.property('operationId');
    }
    else {
        link.operationRef.should.be.type('string');
        link.should.not.have.property('operationId');
    }
    if (typeof link.operationId === 'undefined') {
        link.should.have.property('operationRef');
    }
    else {
        link.operationId.should.be.type('string');
        link.should.not.have.property('operationRef');
        // validate operationId exists (external refs?)
    }
    if (typeof link.parameters !== 'undefined') {
        link.parameters.should.be.type('object');
        link.parameters.should.not.be.an.Array();
    }
    if (typeof link.description !== 'undefined') {
        link.description.should.have.type('string');
    }
    if (typeof link.server !== 'undefined') {
        checkServer(link.server, options);
    }
    options.linter('link', link, options);
}

function checkHeader(header, contextServers, openapi, options) {
    if (header.$ref) {
        var ref = header.$ref;
        should(header.$ref).be.type('string');
        options.linter('reference',header,options);
        header = common.resolveInternal(openapi, ref);
        should(header).not.be.exactly(false, 'Cannot resolve reference: ' + ref);
    }
    header.should.not.have.property('name');
    header.should.not.have.property('in');
    header.should.not.have.property('type');
    for (let prop of common.parameterTypeProperties) {
        header.should.not.have.property(prop);
    }
    if (typeof header.schema !== 'undefined') {
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
        checkSchema(header.schema, emptySchema, 'schema', openapi, options);
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
    options.linter('header',header,options);
}

function checkResponse(response, contextServers, openapi, options) {
    if (response.$ref) {
        var ref = response.$ref;
        should(response.$ref).be.type('string');
        options.linter('reference',response,options);
        response = common.resolveInternal(openapi, ref);
        should(response).not.be.exactly(false, 'Cannot resolve reference: ' + ref);
    }
    response.should.have.property('description');
    should(response.description).have.type('string', 'response description should be of type string');
    response.should.not.have.property('examples');
    response.should.not.have.property('schema', 'response schema must go inside `content` and be listed under a mime type');
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
            checkLink(response.links[l], openapi, options);
            options.context.pop();
        }
        options.context.pop();
    }
    options.linter('response',response,options);
}

function checkParam(param, index, path, contextServers, openapi, options) {
    contextAppend(options, index);
    if (param.$ref) {
        should(param.$ref).be.type('string');
        options.linter('reference',param,options);
        var ref = param.$ref;
        param = common.resolveInternal(openapi, ref);
        should(param).not.be.exactly(false, 'Cannot resolve reference: ' + ref);
    }
    param.should.have.property('name');
    param.name.should.have.type('string');
    param.should.have.property('in');
    param.in.should.have.type('string');
    param.in.should.equalOneOf('query', 'header', 'path', 'cookie');
    if (param.in === 'path') {
        param.should.have.property('required');
        param.required.should.be.exactly(true, 'Path parameters must have an explicit required:true');
        if (path) { // if we're not looking at a param from #/components (checked when used)
            should(path.indexOf('{'+param.name+'}')).be.greaterThan(-1,'path parameters must appear in the path');
        }
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
    if (typeof param.deprecated !== 'undefined') {
        param.deprecated.should.be.a.Boolean();
    }
    if (typeof param.schema !== 'undefined') {
        param.should.not.have.property('content');
        if (typeof param.style !== 'undefined') {
            param.style.should.be.type('string');
            if (param.in === 'path') {
                param.style.should.not.be.exactly('form');
                param.style.should.not.be.exactly('spaceDelimited');
                param.style.should.not.be.exactly('pipeDelimited');
                param.style.should.not.be.exactly('deepObject');
            }
            if (param.in === 'query') {
                param.style.should.not.be.exactly('matrix');
                param.style.should.not.be.exactly('label');
                param.style.should.not.be.exactly('simple');
            }
            if (param.in === 'header') {
                param.style.should.be.exactly('simple');
            }
            if (param.in === 'cookie') {
                param.style.should.be.exactly('form');
            }
        }
        if (typeof param.explode !== 'undefined') {
            param.explode.should.be.type('boolean');
        }
        if (typeof param.allowReserved !== 'undefined') {
            param.allowReserved.should.be.type('boolean');
        }
        if (typeof param.example !== 'undefined') {
            param.should.not.have.key('examples');
        }
        if (typeof param.examples !== 'undefined') {
            contextAppend(options, 'examples');
            param.should.not.have.key('example');
            param.examples.should.be.an.Object();
            param.examples.should.not.be.an.Array();
            for (let e in param.examples) {
                contextAppend(options, e);
                let example = param.examples[e];
                checkExample(example, contextServers, openapi, options);
                options.context.pop();
            }
            options.context.pop();
        }
        checkSchema(param.schema, emptySchema, 'schema', openapi, options);
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
    options.linter('parameter',param,options);
    options.context.pop();
    return param;
}

function checkPathItem(pathItem, path, openapi, options) {

    var contextServers = [];
    contextServers.push(openapi.servers);
    if (pathItem.servers) contextServers.push(pathItem.servers);

    let pathParameters = {};
    if (typeof pathItem.parameters !== 'undefined') should(pathItem.parameters).be.an.Array();
    for (const p in pathItem.parameters) {
        contextAppend(options, 'parameters');
        let param = checkParam(pathItem.parameters[p], p, path, contextServers, openapi, options);
        if (pathParameters[param.in+':'+param.name]) {
            should.fail(false,true,'Duplicate path-level parameter '+param.name);
        }
        else {
            pathParameters[param.in+':'+param.name] = param;
        }
        options.context.pop();
    }

    for (const o in pathItem) {
        contextAppend(options, o);
        var op = pathItem[o];
        if (o === '$ref') {
            should(op).be.ok();
            op.should.have.type('string');
            should(op.startsWith('#/')).equal(false,'PathItem $refs must be external ('+op+')');
            options.linter('reference', pathItem, options);
        }
        else if (o === 'parameters') {
            // checked above
        }
        else if (o === 'servers') {
            contextAppend(options, 'servers');
            checkServers(op, options); // won't be here in converted definitions
            options.context.pop();
        }
        else if (o === 'summary') {
            pathItem.summary.should.have.type('string');
        }
        else if (o === 'description') {
            pathItem.description.should.have.type('string');
        }
        else if (common.httpVerbs.indexOf(o) >= 0) {
            op.should.not.be.empty();
            op.should.not.have.property('consumes');
            op.should.not.have.property('produces');
            op.should.not.have.property('schemes');
            op.should.have.property('responses');
            if (!(typeof op.responses === 'object' && Object.keys(op.responses).length > 0)) {
                should.fail(false,true,'Operation object responses must be a non-empty object');
            }
            if (op.summary) op.summary.should.have.type('string');
            if (op.description) op.description.should.have.type('string');
            if (typeof op.operationId !== 'undefined') {
                op.operationId.should.have.type('string');
                should(options.operationIds.indexOf(op.operationId)).be.exactly(-1,'operationIds must be unique');
                options.operationIds.push(op.operationId);
            }

            if (op.servers) {
                contextAppend(options, 'servers');
                checkServers(op.servers, options); // won't be here in converted definitions
                options.context.pop();
                contextServers.push(op.servers);
            }

            if (op.tags) {
                contextAppend(options, 'tags');
                op.tags.should.be.an.Array();
                for (let tag of op.tags) {
                    tag.should.be.a.String();
                }
                options.context.pop();
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
                if (!r.startsWith('x-')) {
                    contextAppend(options, r);
                    var response = op.responses[r];
                    checkResponse(response, contextServers, openapi, options);
                    options.context.pop();
                }
            }
            options.context.pop();

            if (typeof op.parameters !== 'undefined') {
                should(op.parameters).be.an.Array();
                let localPathParameters = common.clone(pathParameters);
                let opParameters = {};
                contextAppend(options, 'parameters');
                for (let p in op.parameters) {
                    let param = checkParam(op.parameters[p], p, path, contextServers, openapi, options);
                    if (opParameters[param.in+':'+param.name]) {
                        should.fail(false,true,'Duplicate operation-level parameter '+param.name);
                    }
                    else {
                        opParameters[param.in+':'+param.name] = param;
                        delete localPathParameters[param.in+':'+param.name];
                    }
                }

                let contextParameters = Object.assign({},localPathParameters,opParameters);
                path.replace(/\{(.+?)\}/g, function (match, group1) {
                    if (!contextParameters['path:'+group1]) {
                        should.fail(false,true,'Templated parameter '+group1+' not found');
                    }
                });

                options.context.pop();
            }
            if (typeof op.deprecated !== 'undefined') {
                op.deprecated.should.be.a.Boolean();
            }
            if (op.externalDocs) {
                contextAppend(options, 'externalDocs');
                op.externalDocs.should.have.key('url');
                should.doesNotThrow(function () {
 validateUrl(op.externalDocs.url, contextServers, 'externalDocs', options)
},'Invalid externalDocs.url');
                options.context.pop();
            }
            if (op.callbacks) {
                contextAppend(options, 'callbacks');
                for (let c in op.callbacks) {
                    let callback = op.callbacks[c];
                    if (callback.$ref) {
                        options.linter('reference',callback,options);
                    }
                    else {
                        contextAppend(options, c);
                        for (let p in callback) {
                            let cbPi = callback[p];
                            options.isCallback = true;
                            checkPathItem(cbPi, p, openapi, options);
                            options.isCallBack = false;
                        }
                        options.context.pop();
                    }
                }
                options.context.pop();
            }
            if (op.security) {
                checkSecurity(op.security,openapi,options);
            }
            options.linter('operation',op,options);
        }
        options.context.pop();
    }
    options.linter('pathItem',pathItem,options);
    return true;
}

function checkSecurity(security,openapi,options) {
    contextAppend(options, 'security');
    security.should.be.an.Array();
    for (let sr of security) {
        sr.should.be.an.Object();
        for (let i in sr) {
            sr[i].should.be.an.Array();
            let sec = jptr.jptr(openapi,'#/components/securitySchemes/'+i);
            sec.should.not.be.exactly(false,'Could not dereference securityScheme '+i);
            if (sec.type !== 'oauth2') {
                sr[i].should.be.empty();
            }
        }
    }
    options.linter('security',security,options);
    options.context.pop();
}

function validateSync(openapi, options, callback) {
    setupOptions(options,openapi);

    should(openapi).be.an.Object();
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

    for (let k in openapi) {
        if (!k.startsWith('x-')) {
            should(['openapi','info','servers','security','externalDocs','tags','paths','components'].indexOf(k)).be.greaterThan(-1,'OpenAPI object cannot have additionalProperty: '+k);
        }
    }

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
        if (typeof openapi.info.license.url !== 'undefined') {
            should.doesNotThrow(function () {
                validateUrl(openapi.info.license.url, contextServers, 'license.url', options);
            }, 'Invalid license.url');
        }
        options.linter('license', openapi.info.license, options);
        options.context.pop();
    }
    if (typeof openapi.info.termsOfService !== 'undefined') {
        should.doesNotThrow(function () {
 validateUrl(openapi.info.termsOfService, contextServers, 'termsOfService', options)
},'Invalid termsOfService.url');
    }
    if (typeof openapi.info.contact !== 'undefined') {
        contextAppend(options, 'contact');
        openapi.info.contact.should.be.type('object');
        openapi.info.contact.should.not.be.an.Array();
        if (typeof openapi.info.contact.url !== 'undefined') {
            should.doesNotThrow(function () {
 validateUrl(openapi.info.contact.url, contextServers, 'url', options)
},'Invalid contact.url');
        }
        if (typeof openapi.info.contact.email !== 'undefined') {
            openapi.info.contact.email.should.have.type('string');
            should(openapi.info.contact.email.indexOf('@')).be.greaterThan(-1,'Contact email must be a valid email address');
        }
        options.linter('contact',openapi.info.contact,options);
        for (let k in openapi.info.contact) {
            if (!k.startsWith('x-')) {
                should(['name','url','email'].indexOf(k)).be.greaterThan(-1,'info object cannot have additionalProperty: '+k);
            }
        }
        options.context.pop();
    }
    options.linter('info',openapi.info,options);
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
        should.doesNotThrow(function () {
 validateUrl(openapi.externalDocs.url, contextServers, 'externalDocs', options)
},'Invalid externalDocs.url');
        options.context.pop();
    }

    if (openapi.tags) {
        contextAppend(options, 'tags');
        let tagsSeen = new Map();
        for (let tag of openapi.tags) {
            tag.should.have.property('name');
            contextAppend(options, tag.name);
            tag.name.should.have.type('string');
            tagsSeen.has(tag.name).should.be.exactly(false,'Tag names must be unique');
            tagsSeen.set(tag.name,true);
            if (tag.externalDocs) {
                contextAppend(options, 'externalDocs');
                tag.externalDocs.should.have.key('url');
                should.doesNotThrow(function () {
 validateUrl(tag.externalDocs.url, contextServers, 'tag.externalDocs', options)
},'Invalid externalDocs.url');
                options.context.pop();
            }
            options.linter('tag',tag,options);
            options.context.pop();
        }
        options.context.pop();
    }

    if (openapi.security) {
        checkSecurity(openapi.security,openapi,options);
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
            if (scheme.type === 'http') {
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
            if (scheme.type === 'apiKey') {
                scheme.should.have.property('name');
                scheme.name.should.have.type('string');
                scheme.should.have.property('in');
                scheme.in.should.have.type('string');
                scheme.in.should.equalOneOf('query', 'header', 'cookie');
            }
            else {
                scheme.should.not.have.property('name');
                scheme.should.not.have.property('in');
            }
            if (scheme.type === 'oauth2') {
                scheme.should.not.have.property('flow');
                scheme.should.have.property('flows');
                for (let f in scheme.flows) {
                    var flow = scheme.flows[f];
                    if ((f === 'implicit') || (f === 'authorizationCode')) {
                        flow.should.have.property('authorizationUrl');
                        should.doesNotThrow(function () {
 validateUrl(flow.authorizationUrl, contextServers, 'authorizationUrl', options)
},'Invalid authorizationUrl');
                    }
                    else {
                        flow.should.not.have.property('authorizationUrl');
                    }
                    if ((f === 'password') || (f === 'clientCredentials') ||
                        (f === 'authorizationCode')) {
                        flow.should.have.property('tokenUrl');
                        should.doesNotThrow(function () {
 validateUrl(flow.tokenUrl, contextServers, 'tokenUrl', options)
},'Invalid tokenUrl');
                    }
                    else {
                        flow.should.not.have.property('tokenUrl');
                    }
                    if (typeof flow.refreshUrl !== 'undefined') {
                        should.doesNotThrow(function () {
 validateUrl(flow.refreshUrl, contextServers, 'refreshUrl', options)
},'Invalid refreshUrl');
                    }
                    flow.should.have.property('scopes');
                }
            }
            else {
                scheme.should.not.have.property('flows');
            }
            if (scheme.type === 'openIdConnect') {
                scheme.should.have.property('openIdConnectUrl');
                should.doesNotThrow(function () {
 validateUrl(scheme.openIdConnectUrl, contextServers, 'openIdConnectUrl', options)
},'Invalid openIdConnectUrl');
            }
            else {
                scheme.should.not.have.property('openIdConnectUrl');
            }
            options.context.pop();
        }
    }

    common.recurse(openapi, null, function (obj, key, state) {
        if (common.isRef(obj,key)) {
            options.context.push(state.path);
            obj[key].should.not.startWith('#/definitions/');
            var refUrl = url.parse(obj[key]);
            if (!refUrl.protocol && !refUrl.path) {
                should(obj[key]+'/%24ref').not.be.equal(state.path,'Circular reference');
                should(jptr.jptr(openapi,obj[key])).not.be.exactly(false, 'Cannot resolve reference: ' + obj[key]);
            }
            options.context.pop();
        }
    });

    let paths = {};

    for (let p in openapi.paths) {
        options.context.push('#/paths/' + jptr.jpescape(p));
        if (!p.startsWith('x-')) {
            p.should.startWith('/');
            let pCount = 0;
            let template = p.replace(/\{(.+?)\}/g, function () {
                return '{'+(pCount++)+'}';
            });
            if (paths[template] && !openapi["x-hasEquivalentPaths"]) {
                should.fail(false,true,'Identical path templates detected');
            }
            paths[template] = {};
            let templateCheck = p.replace(/\{(.+?)\}/g, function () {
                return '';
            });
            if ((templateCheck.indexOf('{')>=0) || (templateCheck.indexOf('}')>=0)) {
                should.fail(false,true,'Mismatched {} in path template');
            }

            checkPathItem(openapi.paths[p], p, openapi, options);
        }
        options.context.pop();
    }
    if (openapi["x-ms-paths"]) {
        for (let p in openapi["x-ms-paths"]) {
            options.context.push('#/x-ms-paths/' + jptr.jpescape(p));
            p.should.startWith('/');
            checkPathItem(openapi["x-ms-paths"][p], p, openapi, options);
            options.context.pop();
        }
    }

    if (openapi.components && openapi.components.parameters) {
        options.context.push('#/components/parameters/');
        for (let p in openapi.components.parameters) {
            checkParam(openapi.components.parameters[p], p, '', contextServers, openapi, options);
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
            checkSchema(openapi.components.schemas[s], dummySchema, '', openapi, options);
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
            if (ex.$ref) {
                options.linter('reference',ex,options);
            }
            else {
                checkExample(ex, openapi.servers, openapi, options);
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
            if (cb.$ref) {
                options.linter('reference',cb,options);
            }
            else {
                for (let exp in cb) {
                    let cbPi = cb[exp];
                    options.isCallback = true;
                    checkPathItem(cbPi, exp, openapi, options);
                    options.isCallback = false;
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
            if (link.$ref) {
                options.linter('reference',link,options);
            }
            else {
                checkLink(link, openapi, options);
            }
            options.context.pop();
        }
        options.context.pop();
    }

    validateOpenAPI3(openapi);
    const errors = validateOpenAPI3.errors;
    if (errors && errors.length) {
        throw new JSONSchemaError('Failed OpenAPI v3 schema validation', { errors });
    }

    options.valid = !options.expectFailure;
    options.linter('openapi',openapi,options);
    if (callback) callback(null, options);
    return options.valid;
}

function findExternalRefs(master, options, actions) {
    common.recurse(master, {}, function (obj, key, state) {
        if (common.isRef(obj,key)) {
            if (!obj[key].startsWith('#')) {
                options.context.push(state.path);
                actions.push(common.resolveExternal(master, obj[key], options, function (data) {
                    state.parent[state.pkey] = findExternalRefs(data,options,actions);
                }));
                options.context.pop();
            }
        }
    });
    return master;
}

function setupOptions(options, openapi) {
    options.valid = false;
    options.context = ['#/'];
    options.warnings = [];
    options.operationIds = [];
    options.openapi = openapi;
    options.linter = linter.lint;
    options.lintResults = [];
}

function validate(openapi, options, callback) {
    setupOptions(options, openapi);

    const actions = [];
    if (options.resolve) {
        findExternalRefs(openapi, options, actions);
    }

    co(function* () {
        for (const promise of actions) {
            yield promise; // because we mutate the array
        }
        options.context = [];
        validateSync(openapi, options, callback);
    })
    .catch(function (err) {
        callback(err, options);
        return false;
    });
}

module.exports = {
    validate,
    JSONSchemaError
}
