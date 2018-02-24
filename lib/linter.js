'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const should = require('should');

let loadedRules;

// TODO Eventually support more than just core files
function deepMergeRules(ruleNickname, skipRules, rules = []) {
  const ruleFile = path.join(__dirname, '../rules/' + ruleNickname + '.json');
  const content = fs.readFileSync(ruleFile, 'utf8');
  const data = yaml.safeLoad(content, { json: true });

  if (typeof data['require'] == 'string') {
      rules = deepMergeRules(data['require'], rules);
  }

  for (const r in data['rules']) {
      const rule = data['rules'][r];
      if (!rule.enabled) continue;
      if (skipRules.indexOf(rule.name) !== -1) continue;
      if (!Array.isArray(rule.object)) rule.object = [ rule.object ];
      if (rule.alphabetical && rule.alphabetical.properties && !Array.isArray(rule.alphabetical.properties)) {
          rule.alphabetical.properties = [ rule.alphabetical.properties ];
      }
      if (rule.truthy && !Array.isArray(rule.truthy)) rule.truthy = [ rule.truthy ];
      rules.push(rule);
  }

  return rules;
}

function loadRules(loadFiles, skipRules) {
    loadedRules = [];

    const files = (loadFiles.length > 0 ? loadFiles : ['default']);

    for (const f in files) {
        loadedRules = loadedRules.concat(deepMergeRules(files[f], skipRules));
    }
}

function lint(objectName, object, options = {}) {
    for (const r in loadedRules) {
        const rule = loadedRules[r];
        if ((rule.object[0] === '*') || (rule.object.indexOf(objectName)>=0)) {
            options.lintRule = rule;
            if (rule.skip && options[rule.skip]) {
                continue;
            }
            if (rule.truthy) {
                for (const property of rule.truthy) {
                    object.should.have.property(property);
                    object[property].should.not.be.empty();
                }
            }
            if (rule.alphabetical) {
                for (const property of rule.alphabetical.properties) {
                    if (object[property].length < 2) {
                        continue;
                    }

                    const arrayCopy = object[property].slice(0);

                    // If we aren't expecting an object keyed by a specific property, then treat the
                    // object as a simple array.
                    if (!rule.alphabetical.keyedBy) {
                        arrayCopy.sort()
                    } else {
                        const keyedBy = [rule.alphabetical.keyedBy];
                        arrayCopy.sort(function (a, b) {
                            if (a[keyedBy] < b[keyedBy]) {
                                return -1;
                            } else if (a[keyedBy] > b[keyedBy]) {
                                return 1;
                            }
                        })
                    }

                    object.should.have.property(property);
                    object[property].should.be.deepEqual(arrayCopy);
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
            if (rule.notEndWith) {
                should(object[rule.notEndWith.property]).not.endWith(rule.notEndWith.value)
            }
            if (rule.maxLength) {
                const { value, property } = rule.maxLength;
                if (object[property] && (typeof object[property] === 'string')) {
                    object.should.have.property(property).with.lengthOf(value);
                }
            }
        }
    }
    delete options.lintRule;
}

module.exports = {
    lint : lint,
    loadRules : loadRules
};
