'use strict';

function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function convert(swagger, options) {
    var openapi = clone(swagger);

    openapi.openapi = "3.0.0"; // semver
    delete openapi.swagger;

    openapi.hosts = [];
    for (var s in swagger.schemes) {
        var host = {};
        host.host = swagger.host;
        host.basePath = swagger.basePath;
        host.scheme = swagger.schemes[s];
        openapi.hosts.push(host);
    }
    delete openapi.host;
    delete openapi.basePath;
    delete openapi.schemes;

    openapi.components = {};
    openapi.components.definitions = openapi.definitions;
	openapi.components.securityDefinitions = openapi.securityDefinitions;
	openapi.components.parameters = openapi.parameters;
	openapi.components.responses = openapi.responses;
    delete openapi.definitions;
	delete openapi.securityDefinitions;
	delete openapi.parameters;
	delete openapi.responses;
    // new are [responseHeaders, callbacks, links]

	// TODO

	delete openapi.consumes;
	delete openapi.produces;

    return openapi;
}

module.exports = {

    convert : convert

};
