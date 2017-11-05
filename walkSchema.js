'use strict';

const util = require('util');

function walkSchema(schema, parent, state, callback) {

    if (typeof state.depth === 'undefined') state = { depth: 0, seen: new WeakMap(), top:true };
    if (typeof schema.$ref !== 'undefined') {
        let temp = {$ref:schema.$ref};
        callback(temp,parent,state);
        return temp; // all other properties SHALL be ignored
    }
    callback(schema,parent,state);
    if (state.seen.has(schema)) {
        return schema;
    }
    //else
    state.seen.set(schema,true);
    state.top = false;
    state.depth++;

    if (typeof schema.items !== 'undefined') {
        state.property = 'items';
        walkSchema(schema.items,schema,state,callback);
    }
    if (schema.additionalItems) {
        if (typeof schema.additionalItems === 'object') {
            state.property = 'additionalItems';
            walkSchema(schema.additionalItems,schema,state,callback);
        }
    }
    if (schema.additionalProperties) {
        if (typeof schema.additionalProperties === 'object') {
            state.property = 'additionalProperties';
            walkSchema(schema.additionalProperties,schema,state,callback);
        }
    }
    if (schema.properties) {
        for (let prop in schema.properties) {
            let subSchema = schema.properties[prop];
            state.property = 'properties/'+prop;
            walkSchema(subSchema,schema,state,callback);
        }
    }
    if (schema.patternProperties) {
        for (let prop in schema.pattenProperties) {
            let subSchema = schema.patternProperties[prop];
            state.property = 'patternProperties/'+prop;
            walkSchema(subSchema,schema,state,callback);
        }
    }
    if (schema.allOf) {
        for (let subSchema of schema.allOf) {
            state.property = 'allOf';
            walkSchema(subSchema,schema,state,callback);
        }
    }
    if (schema.anyOf) {
        for (let subSchema of schema.anyOf) {
            state.property = 'anyOf';
            walkSchema(subSchema,schema,state,callback);
        }
    }
    if (schema.oneOf) {
        for (let subSchema of schema.oneOf) {
            state.property = 'oneOf';
            walkSchema(subSchema,schema,state,callback);
        }
    }
    if (schema.not) {
        state.property = 'not';
        walkSchema(schema.not,schema,state,callback);
    }
    state.depth--;
    return schema;
}

module.exports = {
    walkSchema: walkSchema
};
