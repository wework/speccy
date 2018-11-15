'use strict';

const should = require('should');

const regexFromString = regex => new RegExp(regex.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, "\\$&"))

const ensureRule = (context, rule, shouldAssertion) => {
    try {
        shouldAssertion();
    }
    catch (error) {
        // rethrow when not a lint error
        if (!error.name || error.name !== "AssertionError") {
            throw error;
        }

        const pointer = (context && context.length > 0 ? context[context.length-1] : null);
        return { pointer, rule, error };
    }
}

let activeRules;
let skipRules;

const init = (params = {}) => {
    activeRules = {};
    skipRules = params.skip || [];
};

const createNewRules = rules => {
    rules.forEach(rule => createNewRule(rule));
};

const createNewRule = rule => {
    if (rule.disabled === true) return;
    // @DEPRECATED in v0.9.0, use `disabled: true`
    if (rule.enabled === false) return;
    if (!Array.isArray(rule.object)) rule.object = [rule.object];
    if (rule.alphabetical && rule.alphabetical.properties && !Array.isArray(rule.alphabetical.properties)) {
        rule.alphabetical.properties = [rule.alphabetical.properties];
    }
    if (rule.truthy && !Array.isArray(rule.truthy)) rule.truthy = [rule.truthy];
    activeRules[rule.name] = rule;
}

const lint = (objectName, object, key, options = {}) => {
    const rules = relevantRules(Object.values(activeRules), skipRules);
    const results = [];

    const ensure = (rule, func) => {
        const result = ensureRule(options.context, rule, func);
        if (result) results.push(result);
    }

    for (const r in rules) {
        const rule = rules[r];
        if ((rule.object[0] === '*') || (rule.object.indexOf(objectName)>=0)) {
            if (rule.truthy) {
                for (const property of rule.truthy) {
                    ensure(rule, () => {
                        object.should.have.property(property);
                        object[property].should.not.be.empty();
                    });
                }
            }
            if (rule.alphabetical) {
                for (const property of rule.alphabetical.properties) {
                    if (!object[property] || object[property].length < 2) {
                        continue;
                    }

                    const arrayCopy = object[property].slice(0);

                    // If we aren't expecting an object keyed by a specific property, then treat the
                    // object as a simple array.
                    if (rule.alphabetical.keyedBy) {
                        const keyedBy = [rule.alphabetical.keyedBy];
                        arrayCopy.sort(function (a, b) {
                            if (a[keyedBy] < b[keyedBy]) {
                                return -1;
                            }
                            else if (a[keyedBy] > b[keyedBy]) {
                                return 1;
                            }
                            return 0;
                        });
                    }
                    else {
                        arrayCopy.sort()
                    }
                    ensure(rule, () => {
                        object.should.have.property(property);
                        object[property].should.be.deepEqual(arrayCopy);
                    });
                }
            }
            if (rule.properties) {
                ensure(rule, () => {
                    // Ignore vendor extensions, for reasons like our the resolver adding x-miro
                    const keys = Object.keys(object).filter(key => !key.startsWith('x-'));
                    should(keys.length).be.exactly(rule.properties);
                });
            }
            if (rule.or) {
                let found = false;
                for (const property of rule.or) {
                    if (typeof object[property] !== 'undefined') found = true;
                }
                ensure(rule, () => {
                    found.should.be.exactly(true,rule.description);
                });
            }
            if (rule.xor) {
                let found = false;
                for (const property of rule.xor) {
                    if (typeof object[property] !== 'undefined') {
                        if (found) {
                            ensure(rule, () => {
                                should.fail(true,false,rule.description);
                            });
                        }
                        found = true;
                    }
                }
                ensure(rule, () => {
                    found.should.be.exactly(true,rule.description);
                });
            }
            if (rule.notEqual) {
                let propertyValues = rule.notEqual.reduce((result, property) => {
                    if (typeof object[property] !== 'undefined') {
                        result.push(object[property]);
                    }
                    return result;
                }, []);

                const equivalent = propertyValues.every( (val, i, arr) => val === arr[0] );

                if (propertyValues.length > 1) {
                    ensure(rule, () => {
                        equivalent.should.be.exactly(false,rule.description);
                    });
                }
            }
            if (rule.pattern) {
                const { omit, property, split, value } = rule.pattern;
                const target = object[property]

                let components = [];
                if (target) {
                    if (split) {
                        components = target.split(split);
                    }
                    else {
                        components.push(target);
                    }
                    const re = new RegExp(value);
                    for (let component of components) {
                        if (omit) component = component.split(omit).join('');
                        if (component) {
                            ensure(rule, () => {
                                should(re.test(component)).be.exactly(true, rule.description);
                            });
                        }
                    }
                }
            }
            if (rule.notContain) {
                const { value, properties } = rule.notContain;
                for (const property of properties) {
                    if (object[property]) {
                        ensure(rule, () => {
                            object[property].should.be.a.String().and.not.match(regexFromString(value), rule.description);
                        });
                    }
                }
            }
            if (rule.notEndWith) {
                const { omit, property, value } = rule.notEndWith;
                let propertyValue = (property === '$key') ? key : object[property];
                if (typeof propertyValue === 'string' && propertyValue.length > 1) {
                    if (omit) {
                        propertyValue = propertyValue.replace(omit, '');
                    }
                    ensure(rule, () => {
                       propertyValue.should.not.endWith(value);
                    });
                }
            }
            if (rule.maxLength) {
                const { value, property } = rule.maxLength;
                if (object[property] && (typeof object[property] === 'string')) {
                    ensure(rule, () => {
                        object[property].length.should.be.belowOrEqual(value)
                    });
                }
            }
        }
    }

    if (results) {
        if (!options.lintResults) options.lintResults = [];
        options.lintResults = options.lintResults.concat(results);
    }

    return results;
}

const relevantRules = (rulesList, skipList) => {
    console.log({skipList, skipRules})
    if (skipList.length === 0) return rulesList;
    return rulesList.filter(rule => skipList.indexOf(rule.name) === -1);
}

module.exports = {
    createNewRule,
    createNewRules,
    init,
    lint,
};
