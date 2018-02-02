'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const should = require('should');

let rules;

function loadRules(loadFiles) {
    rules = [];
    const files = (loadFiles.isEmpty ? loadFiles : ['default']);

    for (const f in files) {
        const content = fs.readFileSync(path.join(__dirname, '../rules/' + files[f] + '.json'), 'utf8');
        const data = yaml.safeLoad(content, { json: true });

        if (typeof data['requires'] == 'string') {
            files.append(data['requires']);
        }

        for (const r in data['rules']) {
            const rule = data['rules'][r];
            if (!rule.enabled) continue;
            if (!Array.isArray(rule.object)) rule.object = [ rule.object ];
            if (rule.truthy && !Array.isArray(rule.truthy)) rule.truthy = [ rule.truthy ];
            rules.push(rule);
        }
    }
}

function lint(objectName,object,options) {

    for (const r in rules) {
        const rule = rules[r];
        if ((rule.object[0] === '*') || (rule.object.indexOf(objectName)>=0)) {
            const lintRule = rule;
            if (rule.skip && options[rule.skip]) {
                continue;
            }
            if (rule.truthy) {
                for (const property of rule.truthy) {
                    object.should.have.property(property);
                    object[property].should.not.be.empty();
                }
            }
            if (rule.properties) {
                should(Object.keys(object).length).be.exactly(rule.properties);
            }
            if (rule.or) {
                let found = false;
                for (const property of rule.or) {
                    if (typeof object[property] !== 'undefined') found = true;
                }
                found.should.be.exactly(true,rule.description);
            }
            if (rule.xor) {
                let found = false;
                for (const property of rule.xor) {
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
                const re = new RegExp(rule.pattern.value);
                for (let component of components) {
                    if (rule.pattern.omit) component = component.split(rule.pattern.omit).join('');
                    if (component) {
                        should(re.test(component)).be.exactly(true,rule.description);
                    }
                }
            }
            if (rule.notContain) {
                for (const property of rule.notContain.properties) {
                    if (object[property] && (typeof object[property] === 'string') &&
                        (object[property].indexOf(rule.notContain.value)>=0)) {
                        should.fail(true,false,rule.description);
                    }
                }
            }
        }
    }
}

module.exports = {
    lint : lint,
    loadRules : loadRules
};
