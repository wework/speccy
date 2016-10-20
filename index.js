'use strict';

function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function convert(swagger) {
    var openapi = clone(swagger);

    return openapi;
}

module.exports = {

    convert : convert

};