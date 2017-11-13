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
    for (let r in rules) {
        let rule = rules[r];
        if (!Array.isArray(rule.object)) rule.object = [ rule.object ];
        if (rule.truthy && !Array.isArray(rule.truthy)) rule.truthy = [ rule.truthy ];
        if (!rule.enabled) delete rules[r];
    }
}

function lint(objectName,object,options) {
    for (let r in rules) {
        let rule = rules[r];
        if ((rule.object[0] === '*') || (rule.object.indexOf(objectName)>=0)) {
            options.lintRule = rule;
            if (rule.truthy) {
                for (let property of rule.truthy) {
                    object.should.have.property(property);
                    object[property].should.not.be.empty();
                }
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
                        if (found) should.fail(true,false,rule.description);
                        found = true;
                    }
                }
                found.should.be.exactly(true,rule.description);
            }
            if (rule.pattern) {
                let components = [];
                if (rule.pattern.split) {
                    components = object[rule.pattern.property].split(rule.pattern.split);
                }
                else {
                    components.push(object[rule.pattern.property]);
                }
                let re = new RegExp(rule.pattern.value);
                for (let component of components) {
                    if (rule.pattern.omit) component = component.split(rule.pattern.omit).join('');
                    if (component) {
                        should(re.test(component)).be.exactly(true,rule.description);
                    }
                }
            }
            if (rule.notContain) {
                for (let property of rule.notContain.properties) {
                    if (object[property] && (typeof object[property] === 'string') &&
                        (object[property].indexOf(rule.notContain.value)>=0)) {
                        should.fail(true,false,rule.description);
                    }
                }
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
