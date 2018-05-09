'use strict';

const openApiV2ValidationStrategy = require('./validation-strategies/openapi-v2.js');
const openApiV3ValidationStrategy = require('./validation-strategies/openapi-v3.js');

class JSONSchemaError extends Error {
    constructor(message, params) {
        super(message);
        this.errors = params.errors;
    }
}

function validate(openapi, options, callback) {
    if (options.openApiVersion !== undefined && options.openApiVersion === 2) {
        openApiV2ValidationStrategy.validate(openapi, options, callback);
    } else {
        openApiV3ValidationStrategy.validate(openapi, options, callback);
    }
}

module.exports = {
    validate,
    JSONSchemaError
}
