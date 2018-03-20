'use strict';

const should = require('should');

let activeRules = [];

const regexFromString = regex => new RegExp(regex.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, "\\$&"))

const ensureRule = (context, rule, shouldAssertion, results) => {
    try {
        shouldAssertion();
    }
    catch (error) {
        // rethrow when not a lint error
        if (!error.name || error.name !== "AssertionError") throw error;

        const pointer = (context && context.length > 0 ? context[context.length-1] : null);
        const result = { pointer, rule, error };
        results.push(result);
    }
}

const setRules = rules => {
    activeRules = rules;
}

const lint = (objectName, object, options = {}) => {
    const rules = activeRules;

    function ensure(rule, func) {
        ensureRule(options.context, rule, func, options.lintResults);
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
                const { value, property } = rule.notEndWith;
                ensure(rule, () => {
                    should(object[property]).not.endWith(value);
                });
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
}

module.exports = {
    setRules,
    lint
};
