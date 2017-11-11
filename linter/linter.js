'use strict';

const fs = require('fs');
const path = require('path');

const yaml = require('js-yaml');
const should = require('should');

let rules = {};

function loadRules(s) {
    let data = fs.readFileSync(s,'utf8');
    let obj = yaml.safeLoad(data,{json:true});
    rules = Object.assign({},rules,obj);
}

function lint(objectName,object,options) {
    for (let r in rules) {
        let rule = rules[r];
        if (rule.enabled && rule.object === objectName) {
            options.lintRule = rule;
            if (rule.truthy) {
                object.should.have.property(rule.truthy);
                object[rule.truthy].should.not.be.empty();
            }
            if (rule.properties) {
                should(Object.keys(object).length).be.exactly(rule.properties);
            }
            if (rule.or) {
                let found = false;
                for (let property of rule.or) {
                    if (typeof object[property] !== 'undefined') found = true;
                }
                found.should.be.exactly(true,rule.description);
            }
            if (rule.xor) {
                let found = false;
                for (let property of rule.xor) {
                    if (typeof object[property] !== 'undefined') {
                        if (found) should.fail(rule.description);
                        found = true;
                    }
                }
                found.should.be.exactly(true,rule.description);
            }
        }
    }
    delete options.lintRule;
}

loadRules(path.join(__dirname,'rules.json'));

module.exports = {
    lint : lint,
    loadRules : loadRules
};
