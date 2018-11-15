'use strict';

const fs = require('fs');
const path = require('path');
const loader = require('../lib/loader.js');
const linter = require('../lib/linter.js');

const runLinter = (object, input, key, options = {}) => {
    return linter.lint(object, input, key, options);
}

const getLinterErrors = linter => {
    return linter.map(result => result.rule.name);
}

const testFixture = (fixture, rules) => {
    fixture.tests.forEach(test => {
        const { input, expectedRuleErrors, expectValid, key, skip = [] } = test;

        // Reset rules
        linter.init({ skip });

        loader.loadRulesets(rules).then(() => {
            const actualRuleErrors = getLinterErrors(runLinter(fixture.object, input, key));
            if (expectValid) {
                var msg = JSON.stringify(input) + ' is valid';
                var assertion = () => actualRuleErrors.should.be.empty('expected no linter errors, but got some');
            } else {
                var msg = JSON.stringify(input) + ' is not valid';
                var assertion = () => actualRuleErrors.should.be.deepEqual(expectedRuleErrors, 'expected linter errors do not match those returned');
            }

            it(msg, done => {
                try {
                    assertion();
                    done();
                }
                catch (err) {
                    done(err);
                }
            });
        });
    });
}

describe('Linter', () => {
    describe('lint()', () => {
        const profilesDir = path.join(__dirname, './profiles/');

        ['default', 'strict'].forEach(profileName => {
            const profile = JSON.parse(fs.readFileSync(profilesDir + profileName + '.json', 'utf8'))

            context(`when "${profileName}" profile is loaded`, () => {
                profile.fixtures.forEach(fixture => {
                    describe(`linting the ${fixture.object} object`, () => {
                        testFixture(fixture, profile.rules);
                    });
                });
            });
        });

        context('when rules are manually passed', () => {
            const lintAndExpectErrors = (rule, input, expectedErrors, args = {}) => {
                linter.init();
                linter.createNewRule(rule);
                getLinterErrors(runLinter('something', input, args.key)).should.be.deepEqual(expectedErrors);
            }

            const lintAndExpectValid = (rule, input, args = {}) => {
                linter.init();
                linter.createNewRule(rule);

                getLinterErrors(runLinter('something', input, args.key)).should.be.empty();
            }

            context('alphabetical', () => {
                const rule = {
                    "name": "alphabetical-name",
                    "object": "*",
                    "alphabetical": {
                        "properties": ["tags"],
                        "keyedBy": "name"
                    }
                };

                it('accepts key values in order', () => {
                    const input = {
                        "tags": [
                            {"name": "bar"},
                            {"name": "foo"}
                        ]
                    };
                    lintAndExpectValid(rule, input);
                });

                it('fails key values out of order', () => {
                    const input = {
                        "tags": [
                            {"name": "foo"},
                            {"name": "bar"}
                        ]
                    };

                    lintAndExpectErrors(rule, input, ['alphabetical-name']);
                });
            });

            context('maxLength', () => {
                const rule = {
                    "name": "gotta-be-five",
                    "object": "*",
                    "maxLength": { "property": "summary", "value": 5 },
                };

                it('accepts values up to the max length', () => {
                    const input = { summary: '12345' };
                    lintAndExpectValid(rule, input);
                });

                it('accepts values below the max length', () => {
                    const input = { summary: '1234' };
                    lintAndExpectValid(rule, input);
                });

                it('is fine if there is no summary', () => {
                    const input = { foo: '123'};
                    lintAndExpectValid(rule, input);
                });

                it('errors when string is too long', () => {
                    const input = { summary: '123456' };
                    lintAndExpectErrors(rule, input, ['gotta-be-five']);
                });
            });

            context('notEndWith', () => {
                context('when property is $key', () => {
                    const rule = {
                        "name": "no-trailing-slash",
                        "object": "*",
                        "notEndWith": { "property": "$key", "value": "/" },
                    };

                    it('accepts a key value with no / at the end', () => {
                        lintAndExpectValid(rule, "value", { key: "foo" });
                    });

                    it('accepts key value with only /', () => {
                        lintAndExpectValid(rule, "value", { key: "/" });
                    });

                    it('errors for key value with / at the end', () => {
                        lintAndExpectErrors(rule, "value", ['no-trailing-slash'], { key: "foo/" });
                    });
                });

                context('when property points to an actual key', () => {
                    const rule = {
                        "name": "no-trailing-slash",
                        "object": "*",
                        "notEndWith": { "property": "foo", "value": "/" }
                    };

                    it('accepts value with no / at the end', () => {
                        const input = { "foo" : "bar" };
                        lintAndExpectValid(rule, input);
                    });

                    it('accepts value of only /', () => {
                        const input = { "foo" : "/" };
                        lintAndExpectValid(rule, input);
                    });

                    it('accepts key with / at the end', () => {
                        const input = { "foo": 'bar' };
                        lintAndExpectValid(rule, input, { key: "foo/" });
                    });

                    it('errors when value has / at the end', () => {
                        const input = { "foo": 'bar/' };
                        lintAndExpectErrors(rule, input, ['no-trailing-slash']);
                    });
                });
            });

            context('properties', () => {
                const rule = {
                    "name": "exactly-two-things",
                    "object": "*",
                    "properties": 2
                };

                it('one is too few', () => {
                    const input = { foo: 'a' };
                    lintAndExpectErrors(rule, input, ['exactly-two-things']);
                });

                it('three is too many', () => {
                    const input = { foo: 'a', bar: 'b', 'baz': 'c' };
                    lintAndExpectErrors(rule, input, ['exactly-two-things']);
                });

                it('two is just right', () => {
                    const input = { foo: 'a', bar: 'b' };
                    lintAndExpectValid(rule, input);
                });

                it('two things and an extension is two things', () => {
                    const input = { foo: 'a', bar: 'b', 'x-baz': 'c' };
                    lintAndExpectValid(rule, input);
                });
            });

            context('pattern', () => {
                context('when split and omit arguments are used', () => {
                    const rule = {
                        "name": "alphadash",
                        "object": "*",
                        "pattern": {
                            "property": "foo",
                            "omit": "#",
                            "split": "/",
                            "value": "^[a-z0-9-]+$"
                        }
                    };

                    it('will ignore the #, split the / and regex the rest', () => {
                        lintAndExpectValid(rule, { "foo": "#foo/bar-baz" });
                    });
                    it('fails when it finds invalid character in the split segments', () => {
                        lintAndExpectErrors(rule, { "foo" : "#foo/bar@#$/baz" }, ['alphadash']);
                    });
                });

                context('when no split or omit argument are used', () => {
                    const rule = {
                        "name": "alphadash",
                        "object": "*",
                        "pattern": {
                            "property": "foo",
                            "value": "^[a-z0-9-]+$"
                        }
                    };

                    it('will allow the regex when its only alphadash', () => {
                        lintAndExpectValid(rule, { "foo": "foo-bar" });
                    });

                    it('errors when non alphadash characters show up', () => {
                        lintAndExpectErrors(rule, { "foo" : "foo/bar" }, ['alphadash']);
                    });
                });
            });

            context('xor', () => {
                const rule = {
                    "name": "one-or-tother",
                    "object": "*",
                    "xor": ["a", "b"]
                };

                it('only allows a or b not both', () => {
                    lintAndExpectValid(rule, { "a": 1, "c": 2 });
                    lintAndExpectErrors(rule, { "a": 1, "b": 2 }, ['one-or-tother']);
                });
            });

            context('not-equal', () => {
                const rule = {
                    "name": "not-equal",
                    "object": "*",
                    "notEqual": ["default", "example"]
                };

                it('if the fields don\'t exist, that\'s fine', () => {
                    const input = {};
                    lintAndExpectValid(rule, input);
                });

                it('fails when two properties are the same', () => {
                    const input = {
                        "default": "foo",
                        "example": "foo"
                    };
                    lintAndExpectErrors(rule, input, ['not-equal']);
                });

                it('passes when two properties are different', () => {
                    const input = {
                        "default": "foo",
                        "example": "bar"
                    };
                    lintAndExpectValid(rule, input);
                });
            });
        });
    });
});
