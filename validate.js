var should = require('should');

var common = require('./common.js');

// TODO validate with ajv 

function checkParam(param){
	param.should.not.have.property('items');
	param.should.not.have.property('collectionFormat');
	if (param.type) param.type.should.not.be.exactly('file');
	if (param.in) {
		param.in.should.not.be.exactly('body');
		param.in.should.not.be.exactly('formData');
	}
	return true;
}

function checkPathItem(pathItem) {
	if (pathItem.parameters) {
		for (var param of pathItem.parameters) {
			checkParam(param);
		}
	}
	for (var o in pathItem) {
		var op = pathItem[o];
		if (op.parameters) {
			for (var param of op.parameters) {
				checkParam(param);
			}
		}
		op.should.not.have.property('consumes');
		op.should.not.have.property('produces');
	}
}

function validate(openapi, options) {
    openapi.should.not.have.key('swagger');
    openapi.should.not.have.key('definitions');
    openapi.should.not.have.key('parameters');
    openapi.should.not.have.key('responses');
    openapi.should.not.have.key('securityDefinitions');
    openapi.should.not.have.key('produces');
    openapi.should.not.have.key('consumes');

    if (openapi.components.securitySchemes) {
        for (var s in openapi.components.securitySchemes) {
            var scheme = openapi.components.securitySchemes[s];
            scheme.type.should.not.be.exactly('basic');
        }
    }

    openapi.openapi.startsWith('3.0.').should.be.ok();

    common.recurse(openapi,{},function(obj,key,parent){
        if ((key === '$ref') && (typeof obj[key] === 'string')) {
            should(obj[key].indexOf('#/definitions/')).be.exactly(-1);
        }
    });

    if (openapi.components.parameters) {
        for (var p in openapi.components.parameters) {
            checkParam(openapi.components.parameters[p]);
        }
    }
    for (var p in openapi.paths) {
        checkPathItem(openapi.paths[p]);
    }
    if (openapi["x-ms-paths"]) {
        for (var p in openapi["x-ms-paths"]) {
            checkPathItem(openapi["x-ms-paths"]);
        }
    }

    return true;
}

module.exports = {
    validate : validate
}