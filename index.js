// @ts-check
'use strict';

var fs = require('fs');
var url = require('url');
var pathlib = require('path');

var co = require('co');
var maybe = require('call-me-maybe');
var fetch = require('node-fetch');
var yaml = require('js-yaml');
var jptr = require('jgexml/jpath.js');

var common = require('./common.js');
var statusCodes = require('./statusCodes.js').statusCodes;

// TODO split out into params, security etc
// TODO handle specification-extensions with plugins?

const targetVersion = '3.0.0';
var componentNames; // initialised in main

function throwError(message, options) {
    var err = new Error(message);
    err.options = options;
    throw err;
}

function throwOrWarn(message, container, options) {
    if (options.warnOnly) {
        container[options.warnProperty||'x-s2o-warning'] = message;
    }
    else {
        throwError(message, options);
    }
}

function fixupSchema(obj, key, state, options) {
    if (state.payload.targetted && (key == 'type') && (Array.isArray(obj[key]))) {
        if (obj[key].length < 2) {
            obj[key] = (obj[key].length ? obj[key][0] : 'string');
        }
        else {
            obj.oneOf = [];
            for (let type of obj[key]) {
                var schema = {};
                if (type === 'null') {
                    obj.nullable = true;
                }
                else {
                    schema.type = type;
                }
                if (type == 'array') {
                    for (let prop of common.arrayProperties) {
                        if (typeof obj[prop] !== 'undefined') {
                            schema[prop] = obj[prop];
                            delete obj[prop];
                        }
                    }
                }
                if (schema.type) obj.oneOf.push(schema);
            }
            if (obj.oneOf.length != 1) {
                delete obj[key];
            }
            else {
                obj[key] = obj.oneOf[0].type;
                delete obj.oneOf;
            }

        }
    }
    if ((key == 'required') && (typeof obj[key] === 'boolean') && state.payload.targetted) {
        delete obj[key]; // TODO check we're at the right level(s) if poss.
    }
    if (state.payload.targetted && (key == 'properties') && (typeof obj[key] === 'object')) {
        if ((state.pkey !== 'properties') && (typeof obj.type === 'undefined')) {
            obj.type = 'object';
        }
    }
    if (state.payload.targetted && (key == 'discriminator') && (typeof obj[key] === 'string')) {
        obj[key] = { propertyName: obj[key] };
    }
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
    if ((key == 'type') && (obj[key] == 'null')) {
        delete obj[key];
        obj.nullable = true;
    }
    if (state.payload.targetted && (key == 'x-nullable') && (typeof obj[key] === 'boolean')) {
        obj.nullable = obj[key];
        delete obj[key];
    }
    if (state.payload.targetted && (key == 'items') && Array.isArray(obj[key])) {
        if (obj[key].length == 0) {
            obj[key] = {};
        }
        else if (obj[key].length == 1) {
            obj[key] = obj[key][0];
        }
        else {
            obj[key] = {
                anyOf: obj[key]
            };
        }
    }
    if ((key == 'x-required') && Array.isArray(obj[key])) {
        if (!obj.required) {
            obj.required = [];
        }
        obj.required = obj.required.concat(obj[key]);
        delete obj[key];
    }
    if (common.isRef(obj,key)) {
        if (obj[key].startsWith('#/definitions/')) {
            //only the first part of a schema component name must be sanitised
            let keys = obj[key].replace('#/definitions/', '').split('/');
            let newKey = componentNames.schemas[keys[0]]; //lookup
            if (!newKey) {
                throwOrWarn('Could not resolve reference '+obj[key],obj,state.payload.options);
            }
            else {
                keys[0] = newKey;
            }
            obj[key] = '#/components/schemas/' + keys.join('/');
        }
        if (obj[key].startsWith('#/parameters/')) {
            // for extensions like Apigee's x-templates
            obj[key] = '#/components/parameters/' + common.sanitise(obj[key].replace('#/parameters/', ''));
        }
        if (obj[key].startsWith('#/responses/')) {
            // for extensions like Apigee's x-templates
            obj[key] = '#/components/responses/' + common.sanitise(obj[key].replace('#/responses/', ''));
        }
    }
    if ((key == 'x-ms-odata') && (typeof obj[key] === 'string')) {
        let keys = obj[key].replace('#/definitions/', '').replace('#/components/schemas/','').split('/');
        let newKey = componentNames.schemas[keys[0]]; //lookup
        if (!newKey) {
            throwOrWarn('Could not resolve reference '+obj[key],obj,state.payload.options);
        }
        else {
            keys[0] = newKey;
        }
        obj[key] = '#/components/schemas/' + keys.join('/');
    }
}

function processSecurity(securityObject) {
    for (let s in securityObject) {
        for (let k in securityObject[s]) {
            var sname = common.sanitise(k);
            if (k != sname) {
                securityObject[s][sname] = securityObject[s][k];
                delete securityObject[s][k];
            }
        }
    }
}

function processSecurityScheme(scheme, options) {
    if (scheme.type == 'basic') {
        scheme.type = 'http';
        scheme.scheme = 'basic';
    }
    if (scheme.type == 'oauth2') {
        var flow = {};
        var flowName = scheme.flow;
        if (scheme.flow == 'application') flowName = 'clientCredentials';
        if (scheme.flow == 'accessCode') flowName = 'authorizationCode';
        if (typeof scheme.authorizationUrl !== 'undefined') flow.authorizationUrl = scheme.authorizationUrl.split('?')[0] || '/';
        if (typeof scheme.tokenUrl !== 'undefined') flow.tokenUrl = scheme.tokenUrl.split('?')[0] || '/';
        flow.scopes = scheme.scopes || {};
        scheme.flows = {};
        scheme.flows[flowName] = flow;
        delete scheme.flow;
        delete scheme.authorizationUrl;
        delete scheme.tokenUrl;
        delete scheme.scopes;
        if (typeof scheme.name !== 'undefined') {
            if (options.patch) {
                delete scheme.name;
            }
            else {
                throwError('(Patchable) oauth2 securitySchemes should not have name property', options);
            }
        }
    }
}

function deleteParameters(value) {
    return !value["x-s2o-delete"];
}

function processHeader(header, options) {
    if (header.$ref) {
        header.$ref = header.$ref.replace('#/responses/', '#/components/responses/');
    }
    else {
        if (header.type && !header.schema) {
            header.schema = {};
        }
        if (header.type) header.schema.type = header.type;
        if (header.items && header.items.collectionFormat) {
            if (header.items.type && header.items.type != 'array') {
                if (header.items.collectionFormat != header.collectionFormat) {
                    throwOrWarn('Nested collectionFormats are not supported', header, options);
                }
                delete header.items.collectionFormat;
            }
        }
        if (typeof header.collectionFormat !== 'undefined') {
            if (header.type != 'array') {
                if (options.patch) {
                    delete header.collectionFormat;
                }
                else {
                    throwError('(Patchable) collectionFormat is only applicable to header.type array', options);
                }
            }
            if (header.collectionFormat == 'csv') {
                header.style = 'simple';
            }
            if (header.collectionFormat == 'ssv') {
                throwOrWarn('collectionFormat:ssv is no longer supported for headers', header, options); // not lossless
            }
            if (header.collectionFormat == 'pipes') {
                throwOrWarn('collectionFormat:pipes is no longer supported for headers', header, options); // not lossless
            }
            if (header.collectionFormat == 'multi') {
                header.explode = true;
            }
            if (header.collectionFormat == 'tsv') {
                throwOrWarn('collectionFormat:tsv is no longer supported', header, options); // not lossless
            }
            delete header.collectionFormat;
        }
        delete header.type;
        for (let prop of common.parameterTypeProperties) {
            if (typeof header[prop] !== 'undefined') {
                header.schema[prop] = header[prop];
                delete header[prop];
            }
        }
        for (let prop of common.arrayProperties) {
            if (typeof header[prop] !== 'undefined') {
                header.schema[prop] = header[prop];
                delete header[prop];
            }
        }
    }
}

function fixParamRef(param, options) {
    if (param.$ref.indexOf('#/parameters/') >= 0) {
        let refComponents = param.$ref.split('#/parameters/');
        param.$ref = refComponents[0] + '#/components/parameters/' + common.sanitise(refComponents[1]);
    }
    if (param.$ref.indexOf('#/definitions/') >= 0) {
        throwOrWarn('Definition used as parameter', param, options);
    }
}

/**
 * @returns requestBody
 */
function processParameter(param, op, path, index, openapi, options) {
    var result = {};
    var singularRequestBody = true;

    var consumes = ((op && op.consumes) || []).concat(openapi.consumes || []);
    consumes = consumes.filter(common.uniqueOnly);

    if (param.$ref && (typeof param.$ref === 'string')) {
        // if we still have a ref here, it must be an internal one
        fixParamRef(param, options);
        var ptr = param.$ref.replace('#/components/parameters/', '');
        var rbody = false;
        let target = openapi.components.parameters[ptr]; // resolves a $ref, must have been sanitised already

        if (((!target) || (target["x-s2o-delete"])) && param.$ref.startsWith('#/')) {
            // if it's gone, chances are it's a requestBody component now unless spec was broken
            param["x-s2o-delete"] = true;
            rbody = true;
        }

        // shared formData parameters from swagger or path level could be used in any combination.
        // we dereference all op.requestBody's then hash them and pull out common ones later

        if (rbody) {
            let ref = param.$ref;
            let newParam = common.resolveInternal(openapi, param.$ref);
            if (!newParam && ref.startsWith('#/')) {
                throwOrWarn('Could not resolve reference ' + ref, param, options);
            }
            else {
                if (newParam) param = newParam; // preserve reference
            }
        }
    }

    if (param.name || param.in) { // if it's a real parameter OR we've dereferenced it

        if (typeof param['x-deprecated'] === 'boolean') {
            param.deprecated = param['x-deprecated'];
            delete param['x-deprecated'];
        }

        if (typeof param['x-example'] !== 'undefined') {
            param.example = param['x-example'];
            delete param['x-example'];
        }

        if ((param.in != 'body') && (!param.type)) {
            if (options.patch) {
                param.type = 'string';
            }
            else {
                throwError('(Patchable) parameter.type is mandatory for non-body parameters', options);
            }
        }
        if (param.type && typeof param.type === 'object' && param.type.$ref) {
            // $ref anywhere sensibility
            param.type = resolveInternal(openapi, param.type.$ref);
        }
        if (param.description && typeof param.description === 'object' && param.description.$ref) {
            // $ref anywhere sensibility
            param.description = resolveInternal(openapi, param.description.$ref);
        }

        var oldCollectionFormat = param.collectionFormat;
        if (param.collectionFormat) {
            if (param.type != 'array') {
                if (options.patch) {
                    delete param.collectionFormat;
                }
                else {
                    throwError('(Patchable) collectionFormat is only applicable to param.type array', options);
                }
            }
            if ((param.collectionFormat == 'csv') && ((param.in == 'query') || (param.in == 'cookie'))) {
                param.style = 'form';
            }
            if ((param.collectionFormat == 'csv') && ((param.in == 'path') || (param.in == 'header'))) {
                param.style = 'simple';
            }
            if (param.collectionFormat == 'ssv') {
                if (param.in == 'query') {
                    param.style = 'spaceDelimited';
                }
                else {
                    throwOrWarn('collectionFormat:ssv is no longer supported except for in:query parameters', param, options); // not lossless
                }
            }
            if (param.collectionFormat == 'pipes') {
                if (param.in == 'query') {
                    param.style = 'pipeDelimited';
                }
                else {
                    throwOrWarn('collectionFormat:pipes is no longer supported except for in:query parameters', param, options); // not lossless
                }
            }
            if (param.collectionFormat == 'multi') {
                param.explode = true;
            }
            if (param.collectionFormat == 'tsv') {
                throwOrWarn('collectionFormat:tsv is no longer supported', param, options); // not lossless
            }
            delete param.collectionFormat;
        }

        if (param.type && (param.type != 'object') && (param.type != 'body') && (param.in != 'formData')) {
            if (param.items && param.schema) {
                throwOrWarn('parameter has array,items and schema', param, options);
            }
            else {
                if ((!param.schema) || (typeof param.schema !== 'object')) param.schema = {};
                param.schema.type = param.type;
                if (param.items) {
                    param.schema.items = param.items;
                    delete param.items;
                    common.recurse(param.schema.items, null, function (obj, key, state) {
                        if ((key == 'collectionFormat') && (typeof obj[key] === 'string')) {
                            if (oldCollectionFormat && obj[key] !== oldCollectionFormat) {
                                throwOrWarn('Nested collectionFormats are not supported', param, options);
                            }
                            delete obj[key]; // not lossless
                        }
                        // TODO recursively process items
                    });
                }
                for (let prop of common.parameterTypeProperties) {
                    if (typeof param[prop] !== 'undefined') param.schema[prop] = param[prop];
                    delete param[prop];
                }
            }
        }

        if (param.schema) {
            common.recurse(param.schema, { payload: { targetted: true, options: options } }, fixupSchema);
        }

        if (param["x-ms-skip-url-encoding"]) {
            param.allowReserved = true;
            if (param.in === 'query') {
                delete param["x-ms-skip-url-encoding"]; // might be in:path, not allowed in OAS3
            }
        }
    }

    if (param.in == 'formData') {
        // convert to requestBody component
        singularRequestBody = false;
        result.content = {};
        var contentType = 'application/x-www-form-urlencoded';
        if ((consumes.length) && (consumes.indexOf('multipart/form-data') >= 0)) {
            contentType = 'multipart/form-data';
        }

        result.content[contentType] = {};
        if (param.schema) {
            result.content[contentType].schema = param.schema;
            if (param.schema.$ref) {
                result['x-s2o-name'] = param.schema.$ref.replace('#/components/schemas/', '');
            }
        }
        else {
            result.content[contentType].schema = {};
            result.content[contentType].schema.type = 'object';
            result.content[contentType].schema.properties = {};
            result.content[contentType].schema.properties[param.name] = {};
            var schema = result.content[contentType].schema;
            let target = result.content[contentType].schema.properties[param.name];
            if (param.description) target.description = param.description;
            if (param.type) target.type = param.type;

            for (let prop of common.parameterTypeProperties) {
                if (typeof param[prop] !== 'undefined') target[prop] = param[prop];
            }
            if (param.required === true) {
                if (!schema.required) schema.required = [];
                schema.required.push(param.name);
            }
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
        if (param.required) result.required = param.required;
        result.content = {};
        result.content["application/octet-stream"] = {};
        result.content["application/octet-stream"].schema = {};
        result.content["application/octet-stream"].schema.type = 'string';
        result.content["application/octet-stream"].schema.format = 'binary';
    }
    if (param.in == 'body') {
        result.content = {};
        if (param.name) result['x-s2o-name'] = (op && op.operationId ? common.sanitiseAll(op.operationId) : '') + ('_' + param.name).toCamelCase();
        if (param.description) result.description = param.description;
        if (param.required) result.required = param.required;

        if (param.schema && param.schema.$ref) {
            result['x-s2o-name'] = param.schema.$ref.replace('#/components/schemas/', '');
        }
        else if (param.schema && (param.schema.type == 'array') && param.schema.items && param.schema.items.$ref) {
            result['x-s2o-name'] = param.schema.items.$ref.replace('#/components/schemas/', '') + 'Array';
        }

        if (!consumes.length) {
            consumes.push('application/json'); // TODO verify default
        }

        for (let mimetype of consumes) {
            result.content[mimetype] = {};
            result.content[mimetype].schema = common.clone(param.schema) || {};
            common.recurse(result.content[mimetype].schema, { payload: { targetted: true, options: options } }, fixupSchema);
        }
    }

    if (Object.keys(result).length > 0) {
        param["x-s2o-delete"] = true;
        // work out where to attach the requestBody
        if (op) {
            if (op.requestBody && singularRequestBody) {
                op.requestBody["x-s2o-overloaded"] = true;
                let opId = op.operationId || index;

                throwOrWarn('Operation ' + opId + ' has multiple requestBodies', op, options);
            }
            else {
                op.requestBody = Object.assign({}, op.requestBody); // make sure we have one
                if ((op.requestBody.content && op.requestBody.content["multipart/form-data"])
                    && (result.content["multipart/form-data"])) {
                    op.requestBody.content["multipart/form-data"].schema.properties =
                        Object.assign(op.requestBody.content["multipart/form-data"].schema.properties, result.content["multipart/form-data"].schema.properties);
                }
                else if ((op.requestBody.content && op.requestBody.content["application/x-www-form-urlencoded"])
                    && (result.content["application/x-www-form-urlencoded"])) {
                    op.requestBody.content["application/x-www-form-urlencoded"].schema.properties =
                        Object.assign(op.requestBody.content["application/x-www-form-urlencoded"].schema.properties, result.content["application/x-www-form-urlencoded"].schema.properties);
                }
                else {
                    op.requestBody = Object.assign(op.requestBody, result);
                    if (!op.requestBody['x-s2o-name']) {
                        if (op.requestBody.schema && op.requestBody.schema.$ref) {
                            op.requestBody['x-s2o-name'] = op.requestBody.schema.$ref.replace('#/components/schemas/', '').split('/').join('');
                        }
                        else if (op.operationId) {
                            op.requestBody['x-s2o-name'] = common.sanitiseAll(op.operationId);
                        }
                    }
                }
            }
        }
    }

    // tidy up
    delete param.type;
    for (let prop of common.parameterTypeProperties) {
        delete param[prop];
    }

    if ((param.in == 'path') && ((typeof param.required === 'undefined') || (param.required !== true))) {
        if (options.patch) {
            param.required = true;
        }
        else {
            throwError('(Patchable) path parameters must be required:true', options);
        }
    }

    return result;
}

function processResponse(response, name, op, openapi, options) {
    if (response.$ref && (typeof response.$ref === 'string')) {
        if (response.$ref.indexOf('#/definitions/') >= 0) {
            //response.$ref = '#/components/schemas/'+common.sanitise(response.$ref.replace('#/definitions/',''));
            throwOrWarn('definition used as response: ' + response.$ref, response, options);
        }
        else {
            if (response.$ref.startsWith('#/responses/')) {
                response.$ref = '#/components/responses/' + common.sanitise(response.$ref.replace('#/responses/', ''));
            }
        }
    }
    else {
        if ((typeof response.description === 'undefined') || (response.description === null)
            || ((response.description === '') && options.patch)) {
            if (options.patch) {
                var sc = statusCodes.find(function (e) {
                    return e.code == name;
                });
                if ((typeof response === 'object') && (!Array.isArray(response))) {
                    response.description = (sc ? sc.phrase : '');
                }
            }
            else {
                throwError('(Patchable) response.description is mandatory', options);
            }
        }
        if (response.schema) {

            common.recurse(response.schema, { payload: { targetted: true, options: options } }, fixupSchema);

            if (response.schema.$ref && (typeof response.schema.$ref === 'string') && response.schema.$ref.startsWith('#/responses/')) {
                response.schema.$ref = '#/components/responses/' + common.sanitise(response.schema.$ref.replace('#/responses/', ''));
            }

            var produces = ((op && op.produces) || []).concat(openapi.produces || []).filter(common.uniqueOnly);
            if (!produces.length) produces.push('*/*'); // TODO verify default

            response.content = {};
            for (let mimetype of produces) {
                response.content[mimetype] = {};
                response.content[mimetype].schema = common.clone(response.schema);
                if (response.examples && response.examples[mimetype]) {
                    let example = {};
                    example.value = response.examples[mimetype];
                    response.content[mimetype].examples = {};
                    response.content[mimetype].examples.response = example;
                    delete response.examples[mimetype];
                }
                if (response.content[mimetype].schema.type == 'file') {
                    delete response.content[mimetype].schema;
                }
            }
            delete response.schema;
        }
        // examples for content-types not listed in produces
        for (let mimetype in response.examples) {
            if (!response.content) response.content = {};
            if (!response.content[mimetype]) response.content[mimetype] = {};
            response.content[mimetype].examples = {};
            response.content[mimetype].examples.response = {};
            response.content[mimetype].examples.response.value = response.examples[mimetype];
        }
        delete response.examples;
        if (response.headers) {
            for (let h in response.headers) {
                if (h.toLowerCase() == 'status code') {
                    if (options.patch) {
                        delete response.headers[h];
                    }
                    else {
                        throwError('(Patchable) "Status Code" is not a valid header', options);
                    }
                }
                else {
                    processHeader(response.headers[h], options);
                }
            }
        }
    }
}

function processPaths(container, containerName, options, requestBodyCache, openapi) {
    for (let p in container) {
        var path = container[p];
        // path.$ref is external only
        if ((path['x-trace']) && (typeof path['x-trace'] === 'object')) {
            path.trace = path['x-trace'];
            delete path['x-trace'];
        }
        if ((path['x-summary']) && (typeof path['x-summary'] === 'string')) {
            path.summary = path['x-summary'];
            delete path['x-summary'];
        }
        if ((path['x-description']) && (typeof path['x-description'] === 'string')) {
            path.description = path['x-description'];
            delete path['x-description'];
        }
        if ((path['x-servers']) && (Array.isArray(path['x-servers']))) {
            path.servers = path['x-servers'];
            delete path['x-servers'];
        }
        for (let method in path) {
            if ((common.httpVerbs.indexOf(method) >= 0) || (method === 'x-amazon-apigateway-any-method')) {
                var op = path[method];

                if ((op['x-servers']) && (Array.isArray(op['x-servers']))) {
                    op.servers = op['x-servers'];
                    delete op['x-servers'];
                }

                if (op.parameters && Array.isArray(op.parameters)) {
                    if (path.parameters) {
                        for (let param of path.parameters) {
                            if (typeof param.$ref === 'string') {
                                fixParamRef(param, options);
                                param = common.resolveInternal(openapi, param.$ref);
                            }
                            var match = op.parameters.find(function (e, i, a) {
                                return ((e.name == param.name) && (e.in == param.in));
                            });

                            if (!match && (param.in === 'formData') || (param.in === 'body') || (param.type === 'file')) {
                                processParameter(param, op, path, p, openapi, options);
                            }
                        }
                    }
                    for (let param of op.parameters) {
                        processParameter(param, op, path, method + ':' + p, openapi, options);
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
                for (let r in op.responses) {
                    var response = op.responses[r];
                    processResponse(response, r, op, openapi, options);
                }

                if (op.schemes && op.schemes.length) {
                    for (let scheme of op.schemes) {
                        if ((!openapi.schemes) || (openapi.schemes.indexOf(scheme) < 0)) {
                            if (!op.servers) {
                                op.servers = [];
                            }
                            for (let server of openapi.servers) {
                                let newServer = common.clone(server);
                                let serverUrl = url.parse(newServer.url);
                                serverUrl.protocol = scheme;
                                newServer.url = serverUrl.format();
                                op.servers.push(newServer);
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
                delete op.schemes;
                if (op.parameters && op.parameters.length === 0) delete op.parameters;

                common.recurse(op, { payload: { targetted: false, options: options } }, fixupSchema); // for x-ms-odata etc

                if (op.requestBody) {
                    var effectiveOperationId = op.operationId ? common.sanitiseAll(op.operationId) : common.sanitiseAll(method + p).toCamelCase();
                    var rbName = common.sanitise(op.requestBody['x-s2o-name'] || effectiveOperationId || '');
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
                    let ptr = '#/'+containerName+'/'+encodeURIComponent(jptr.jpescape(p))+'/'+method+'/requestBody';
                    requestBodyCache[rbSha256].refs.push(ptr);
                }

            }
        }
        if (path.parameters) {
            for (let p2 in path.parameters) {
                var param = path.parameters[p2];
                processParameter(param, null, path, p, openapi, options); // index here is the path string
            }
            if (!options.debug) {
                path.parameters = path.parameters.filter(deleteParameters);
            }
        }
    }
}

function main(openapi, options) {

    var requestBodyCache = {};
    componentNames = { schemas: {} };

    if (openapi.security) processSecurity(openapi.security);

    for (let s in openapi.components.securitySchemes) {
        let sname = common.sanitise(s);
        if (s != sname) {
            if (openapi.components.securitySchemes[sname]) {
                throwError('Duplicate sanitised securityScheme name ' + sname, options);
            }
            openapi.components.securitySchemes[sname] = openapi.components.securitySchemes[s];
            delete openapi.components.securitySchemes[s];
        }
        processSecurityScheme(openapi.components.securitySchemes[sname], options);
    }

    for (let s in openapi.components.schemas) {
        let sname = common.sanitiseAll(s);
        let suffix = '';
        if (s != sname) {
            while (openapi.components.schemas[sname + suffix]) {
                // @ts-ignore
                suffix = (suffix ? ++suffix : 2);
            }
            openapi.components.schemas[sname + suffix] = openapi.components.schemas[s];
            delete openapi.components.schemas[s];
        }
        componentNames.schemas[s] = sname + suffix;
    }

    for (let p in openapi.components.parameters) {
        let sname = common.sanitise(p);
        if (p != sname) {
            if (openapi.components.parameters[sname]) {
                throwError('Duplicate sanitised parameter name ' + sname, options);
            }
            openapi.components.parameters[sname] = openapi.components.parameters[p];
            delete openapi.components.parameters[p];
        }
        var param = openapi.components.parameters[sname];
        processParameter(param, null, null, sname, openapi, options);
    }

    common.recurse(openapi.components.responses, { payload: { targetted: false, options: options } }, fixupSchema);
    for (let r in openapi.components.responses) {
        let sname = common.sanitise(r);
        if (r != sname) {
            if (openapi.components.responses[sname]) {
                throwError('Duplicate sanitised response name ' + sname, options);
            }
            openapi.components.responses[sname] = openapi.components.responses[r];
            delete openapi.components.responses[r];
        }
        var response = openapi.components.responses[sname];
        processResponse(response, sname, null, openapi, options);
        if (response.headers) {
            for (let h in response.headers) {
                if (h.toLowerCase() == 'status code') {
                    if (options.patch) {
                        delete response.headers[h];
                    }
                    else {
                        throwError('(Patchable) "Status Code" is not a valid header', options);
                    }
                }
                else {
                    processHeader(response.headers[h], options);
                }
            }
        }
    }

    for (let r in openapi.components.requestBodies) { // converted ones
        var rb = openapi.components.requestBodies[r];
        var rbStr = JSON.stringify(rb);
        var rbSha256 = common.sha256(rbStr);
        let entry = {};
        entry.name = r;
        entry.body = rb;
        entry.refs = [];
        requestBodyCache[rbSha256] = entry;
    }

    processPaths(openapi.paths, 'paths', options, requestBodyCache, openapi);
    if (openapi["x-ms-paths"]) {
        processPaths(openapi["x-ms-paths"], 'x-ms-paths', options, requestBodyCache, openapi);
    }

    if (!options.debug) {
        for (let p in openapi.components.parameters) {
            param = openapi.components.parameters[p];
            if (param["x-s2o-delete"]) {
                delete openapi.components.parameters[p];
            }
        }
    }

    common.recurse(openapi.components.schemas, { payload: { targetted: true, options: options } }, fixupSchema);
    common.recurse(openapi.components.schemas, { payload: { targetted: true, options: options } }, fixupSchema); // second pass for fixed x-anyOf's etc
    common.recurse(openapi, { payload: { targetted: false, options: options } }, fixupSchema); // pass across whole definition for $refs in vendor extensions
    common.recurse(openapi, { payload: { targetted: false, options: options } }, fixupSchema); // second pass for fixed x-anyOf's etc

    if (options.debug) {
        openapi["x-s2o-consumes"] = openapi.consumes || [];
        openapi["x-s2o-produces"] = openapi.produces || [];
    }
    delete openapi.consumes;
    delete openapi.produces;
    delete openapi.schemes;

    var rbNamesGenerated = [];

    openapi.components.requestBodies = {}; // for now as we've dereffed them

    var counter = 1;
    for (let e in requestBodyCache) {
        let entry = requestBodyCache[e];
        if (entry.refs.length > 1) {
            // create a shared requestBody
            var suffix = '';
            if (!entry.name) {
                entry.name = 'requestBody';
                // @ts-ignore
                suffix = counter++;
            }
            while (rbNamesGenerated.indexOf(entry.name + suffix) >= 0) {
                // @ts-ignore - this can happen if descriptions are not exactly the same (e.g. bitbucket)
                suffix = (suffix ? ++suffix : 2);
            }
            entry.name = entry.name + suffix;
            rbNamesGenerated.push(entry.name);
            openapi.components.requestBodies[entry.name] = common.clone(entry.body);
            for (let r in entry.refs) {
                var ref = {};
                ref.$ref = '#/components/requestBodies/' + entry.name;
                jptr.jptr(openapi,entry.refs[r],ref);
            }
        }
    }

    if (openapi.components.responses && Object.keys(openapi.components.responses).length === 0) {
        delete openapi.components.responses;
    }
    if (openapi.components.parameters && Object.keys(openapi.components.parameters).length === 0) {
        delete openapi.components.parameters;
    }
    if (openapi.components.examples && Object.keys(openapi.components.examples).length === 0) {
        delete openapi.components.examples;
    }
    if (openapi.components.requestBodies && Object.keys(openapi.components.requestBodies).length === 0) {
        delete openapi.components.requestBodies;
    }
    if (openapi.components.securitySchemes && Object.keys(openapi.components.securitySchemes).length === 0) {
        delete openapi.components.securitySchemes;
    }
    if (openapi.components.headers && Object.keys(openapi.components.headers).length === 0) {
        delete openapi.components.headers;
    }
    if (openapi.components.schemas && Object.keys(openapi.components.schemas).length === 0) {
        delete openapi.components.schemas;
    }
    if (openapi.components && Object.keys(openapi.components).length === 0) {
        delete openapi.components;
    }

    return openapi;
}

function extractServerParameters(server) {
    server.url = server.url.split('{{').join('{');
    server.url = server.url.split('}}').join('}');
    server.url.replace(/\{(.+?)\}/g, function (match, group1) { // TODO extend to :parameters (not port)?
        if (!server.variables) {
            server.variables = {};
        }
        server.variables[group1] = { default: 'unknown' };
    });
}

function convertObj(swagger, options, callback) {
    return maybe(callback, new Promise(function (resolve, reject) {
        if (swagger.openapi && (typeof swagger.openapi === 'string') && swagger.openapi.startsWith('3.')) {
            options.openapi = swagger;
            return resolve(options);
        }
        if ((!swagger.swagger) || (swagger.swagger != "2.0")) {
            return reject(new Error('Unsupported swagger/OpenAPI version: ' + swagger.swagger));
        }

        var openapi = options.openapi = {};
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
        openapi = Object.assign(openapi, common.clone(swagger));
        delete openapi.swagger;

        if (swagger.host && swagger.schemes) {
            for (let s of swagger.schemes) {
                let server = {};
                server.url = s + '://' + swagger.host + (swagger.basePath ? swagger.basePath : '/');
                extractServerParameters(server);
                openapi.servers.push(server);
            }
        }
        else if (swagger.basePath) {
            let server = {};
            server.url = swagger.basePath;
            extractServerParameters(server);
            openapi.servers.push(server);
        }
        delete openapi.host;
        delete openapi.basePath;

        if (openapi['x-servers'] && Array.isArray(openapi['x-servers'])) {
            openapi.servers = openapi['x-servers'].concat(openapi.servers);
            delete openapi['x-servers'];
        }

        // TODO APIMatic extensions (x-server-configuration) ?

        if (swagger['x-ms-parameterized-host']) {
            var xMsPHost = swagger['x-ms-parameterized-host'];
            let server = {};
            server.url = xMsPHost.hostTemplate;
            server.variables = {};
            for (let msp in xMsPHost.parameters) {
                let param = xMsPHost.parameters[p];
                if (param.$ref) {
                    param = common.resolveInternal(openapi, param.$ref);
                }
                if (!msp.startsWith('x-')) {
                    delete param.required; // all true
                    delete param.type; // all strings
                    delete param.in; // all 'host'
                    if (typeof param.default === 'undefined') {
                        if (param.enum) {
                            param.default = param.enum[0];
                        }
                        else {
                            param.default = '';
                        }
                    }
                    server.variables[param.name] = param;
                    delete param.name;
                }
            }
            openapi.servers.push(server);
            delete openapi['x-ms-parameterized-host'];
        }

        if (!openapi.info) {
            if (options.patch) {
                openapi.info = { version: '', title: '' };
            }
            else {
                return reject(new Error('(Patchable) info object is mandatory'));
            }
        }
        if ((typeof openapi.info.title === 'undefined') || (openapi.info.title === null)) {
            if (options.patch) {
                openapi.info.title = '';
            }
            else {
                return reject(new Error('(Patchable) info.title cannot be null'));
            }
        }
        if ((typeof openapi.info.version === 'undefined') || (openapi.info.version === null)) {
            if (options.patch) {
                openapi.info.version = '';
            }
            else {
                return reject(new Error('(Patchable) info.version cannot be null'));
            }
        }
        if (typeof openapi.info.version !== 'string') {
            if (options.patch) {
                openapi.info.version = openapi.info.version.toString();
            }
            else {
                return reject(new Error('(Patchable) info.version cannot be null'));
            }
        }
        if (typeof openapi.info.logo !== 'undefined') {
            if (options.patch) {
                openapi.info['x-logo'] = openapi.info.logo;
                delete openapi.info.logo;
            }
            else return reject(new Error('(Patchable) info should not have logo property'));
        }
        if (typeof openapi.info.termsOfService !== 'undefined') {
            if (openapi.info.termsOfService === null) {
                if (options.patch) {
                    openapi.info.termsOfService = '';
                }
                else {
                    return reject(new Error('(Patchable) info.termsOfService cannot be null'));
                }
            }
            if (url.URL && options.whatwg) {
                try {
                    url.URL.parse(openapi.info.termsOfService);
                }
                catch (ex) {
                    if (options.patch) {
                        delete openapi.info.termsOfService;
                    }
                    else return reject(new Error('(Patchable) info.termsOfService must be a URL'));
                }
            }
        }

        openapi.components = {};
        openapi.components.schemas = openapi.definitions || {};
        openapi.components.responses = openapi.responses || {};
        openapi.components.parameters = openapi.parameters || {};
        openapi.components.examples = {};
        openapi.components.requestBodies = {};
        openapi.components.securitySchemes = openapi.securityDefinitions || {};
        openapi.components.headers = {};
        if (openapi['x-links']) {
            openapi.components.links = openapi['x-links'];
            delete openapi['x-links'];
        }
        if (openapi['x-callbacks']) {
            openapi.components.callbacks = openapi['x-callbacks'];
            delete openapi['x-callbacks'];
        }
        delete openapi.definitions;
        delete openapi.responses;
        delete openapi.parameters;
        delete openapi.securityDefinitions;

        var actions = [];
        options.externals = [];

        function findExternalRefs(master,options,actions) {
            common.recurse(master, null, function (obj, key, state) {
                if (common.isRef(obj,key)) {
                    if (!obj[key].startsWith('#')) {
                        actions.push(common.resolveExternal(master, obj[key], options, function (data) {
                            var external = {};
                            external.context = state.path;
                            external.$ref = obj[key];
                            external.original = common.clone(data);
                            external.updated = data;
                            options.externals.push(external);
                            findExternalRefs(data,options,actions);
                            state.parent[state.pkey] = data;
                        }));
                    }
                }
            });
        }

        if (options.resolve) {
            findExternalRefs(openapi, options, actions);
        }

        co(function* () {
            // resolve multiple promises in parallel
            for (let action of actions) {
                yield action; // because we can mutate the array
            }
            main(openapi, options);
            if (options.direct) {
                resolve(options.openapi);
            }
            else {
                resolve(options);
            }
        })
        .catch(function (err) {
            reject(err);
        });
    }));
}

function convertStr(str, options, callback) {
    return maybe(callback, new Promise(function (resolve, reject) {
        var obj = null;
        try {
            obj = JSON.parse(str);
        }
        catch (ex) {
            try {
                obj = yaml.safeLoad(str, { json: true });
                options.sourceYaml = true;
            }
            catch (ex) { }
        }
        if (obj) {
            return convertObj(obj, options, callback)
        }
        else {
            reject(new Error('Could not resolve url'));
        }
    }));
}

function convertUrl(url, options, callback) {
    return maybe(callback, new Promise(function (resolve, reject) {
        if (!options.origin) {
            options.origin = url;
        }
        if (options.verbose) {
            console.log('GET ' + url);
        }
        fetch(url).then(function (res) {
            return res.text();
        }).then(function (body) {
            return convertStr(body, options, callback);
        }).catch(function (err) {
            reject(err);
        });
    }));
}

function convertFile(filename, options, callback) {
    return maybe(callback, new Promise(function (resolve, reject) {
        fs.readFile(filename, options.encoding || 'utf8', function (err, s) {
            if (err) {
                reject(err);
            }
            else {
                options.sourceFile = filename;
                return convertStr(s, options, callback)
            }
        });
    }));
}

function convertStream(readable, options, callback) {
    return maybe(callback, new Promise(function (resolve, reject) {
        var data = '';
        readable.on('data', function (chunk) {
            data += chunk;
        })
            .on('end', function () {
                return convertStr(data, options, callback);
            });
    }));
}

module.exports = {
    targetVersion: targetVersion,
    convert: convertObj,
    convertObj: convertObj,
    convertUrl: convertUrl,
    convertStr: convertStr,
    convertFile: convertFile,
    convertStream: convertStream
};
