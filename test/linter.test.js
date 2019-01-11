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
        linter.init();

        loader.loadRuleFiles(rules).then(() => {
            const actualRuleErrors = getLinterErrors(runLinter(fixture.object, input, key, { skip }));
            if (expectValid) {
                var msg = JSON.stringify(input) + ' is valid';
                var assertion = () => expect(actualRuleErrors).toEqual([]);
            } else {
                var msg = JSON.stringify(input) + ' is not valid';
                var assertion = () => expect(actualRuleErrors).toEqual(expectedRuleErrors);
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

            describe('when `' + profileName + '` profile is loaded', () => {
                profile.fixtures.forEach(fixture => {
                    describe(`linting the ${fixture.object} object`, () => {
                        testFixture(fixture, profile.rules);
                    });
                });
            });
        });

        describe('when rules are manually passed', () => {
            const prepareLinter = (rule) => {
                linter.init();
                linter.createNewRule(rule);
            }
            const lintAndExpectErrors = (rule, input, expectedErrors, args = {}) => {
                prepareLinter(rule);
                const errors = getLinterErrors(runLinter('something', input, args.key));
                expect(errors).toEqual(expectedErrors);
            }

            const lintAndExpectValid = (rule, input, args = {}) => {
                prepareLinter(rule);
                const errors = getLinterErrors(runLinter('something', input, args.key));
                expect(errors).toEqual(errors);
            }

            describe('alphabetical', () => {
                const rule = {
                    "name": "alphabetical-name",
                    "object": "*",
                    "enabled": true,
                    "alphabetical": {
                        "properties": ["tags"],
                        "keyedBy": "name"
                    }
                };

                test('accepts key values in order', () => {
                    const input = {
                        "tags": [
                            {"name": "bar"},
                            {"name": "foo"}
                        ]
                    };
                    lintAndExpectValid(rule, input);
                });

                test('fails key values out of order', () => {
                    const input = {
                        "tags": [
                            {"name": "foo"},
                            {"name": "bar"}
                        ]
                    };

                    lintAndExpectErrors(rule, input, ['alphabetical-name']);
                });
            });

            describe('maxLength', () => {
                const rule = {
                    "name": "gotta-be-five",
                    "object": "*",
                    "enabled": true,
                    "maxLength": { "property": "summary", "value": 5 },
                };

                test('accepts values up to the max length', () => {
                    const input = { summary: '12345' };
                    lintAndExpectValid(rule, input);
                });

                test('accepts values below the max length', () => {
                    const input = { summary: '1234' };
                    lintAndExpectValid(rule, input);
                });

                test('is fine if there is no summary', () => {
                    const input = { foo: '123'};
                    lintAndExpectValid(rule, input);
                });

                test('errors when string is too long', () => {
                    const input = { summary: '123456' };
                    lintAndExpectErrors(rule, input, ['gotta-be-five']);
                });
            });

            describe("notContain", () => {
                describe('when linting with a string', () => {
                    const rule = {
                        "name": "doesnt-contain-foo",
                        "object": "*",
                        "enabled": true,
                        "notContain": { "properties": ["description"], "value": "foo" }
                    }

                    test('accepts a value when foo is not present', () => {
                        lintAndExpectValid(rule, {"description": "bar"});
                    });

                    test('errors when foo is present', () => {
                        lintAndExpectErrors(rule, {"description": "foo"}, ['doesnt-contain-foo']);
                        lintAndExpectErrors(rule, {"description": "foobar"}, ['doesnt-contain-foo']);
                    });
                });

                describe('when linting with regex', () => {
                    let rule = {
                        "name": "doesnt-contain-foo",
                        "object": "*",
                        "enabled": true,
                        "notContain": {
                            "properties": ["description"],
                            "pattern": {
                                "value": "[f|F]oo"
                            }
                        }
                    }

                    test('accepts a value when foo is not present', () => {
                        lintAndExpectValid(rule, {"description": "bar"});
                    });

                    test('errors when foo is present', () => {
                        lintAndExpectErrors(rule, {"description": "foobar"}, ['doesnt-contain-foo']);
                    });

                    describe('when supplying additional regex flags', () => {
                        rule.notContain.pattern.value = 'foo'
                        rule.notContain.pattern.flags = 'gi'

                        test('accepts a value when foo is not present', () => {
                            lintAndExpectValid(rule, {"description": "bar"});
                        });

                        test('errors when foo is present', () => {
                            lintAndExpectErrors(rule, {"description": "fOoBaR"}, ['doesnt-contain-foo']);
                        });
                    })
                })
            });

            describe('notEndWith', () => {
                describe('when property is $key', () => {
                    const rule = {
                        "name": "no-trailing-slash",
                        "object": "*",
                        "enabled": true,
                        "notEndWith": { "property": "$key", "value": "/" },
                    };

                    test('accepts a key value with no / at the end', () => {
                        lintAndExpectValid(rule, "value", { key: "foo" });
                    });

                    test('accepts key value with only /', () => {
                        lintAndExpectValid(rule, "value", { key: "/" });
                    });

                    test('errors for key value with / at the end', () => {
                        lintAndExpectErrors(rule, "value", ['no-trailing-slash'], { key: "foo/" });
                    });
                });

                describe('when property points to an actual key', () => {
                    const rule = {
                        "name": "no-trailing-slash",
                        "object": "*",
                        "enabled": true,
                        "notEndWith": { "property": "foo", "value": "/" }
                    };

                    test('accepts value with no / at the end', () => {
                        const input = { "foo" : "bar" };
                        lintAndExpectValid(rule, input);
                    });

                    test('accepts value of only /', () => {
                        const input = { "foo" : "/" };
                        lintAndExpectValid(rule, input);
                    });

                    test('accepts key with / at the end', () => {
                        const input = { "foo": 'bar' };
                        lintAndExpectValid(rule, input, { key: "foo/" });
                    });

                    test('errors when value has / at the end', () => {
                        const input = { "foo": 'bar/' };
                        lintAndExpectErrors(rule, input, ['no-trailing-slash']);
                    });
                });
            });

            describe('properties', () => {
                const rule = {
                    "name": "exactly-two-things",
                    "object": "*",
                    "enabled": true,
                    "properties": 2
                };

                test('one is too few', () => {
                    const input = { foo: 'a' };
                    lintAndExpectErrors(rule, input, ['exactly-two-things']);
                });

                test('three is too many', () => {
                    const input = { foo: 'a', bar: 'b', 'baz': 'c' };
                    lintAndExpectErrors(rule, input, ['exactly-two-things']);
                });

                test('two is just right', () => {
                    const input = { foo: 'a', bar: 'b' };
                    lintAndExpectValid(rule, input);
                });

                test('two things and an extension is two things', () => {
                    const input = { foo: 'a', bar: 'b', 'x-baz': 'c' };
                    lintAndExpectValid(rule, input);
                });
            });

            describe('pattern', () => {
                describe('when split and omit arguments are used', () => {
                    const rule = {
                        "name": "alphadash",
                        "object": "*",
                        "enabled": true,
                        "pattern": {
                            "property": "foo",
                            "omit": "#",
                            "split": "/",
                            "value": "^[a-z0-9-]+$"
                        }
                    };

                    test('will ignore the #, split the / and regex the rest', () => {
                        lintAndExpectValid(rule, { "foo": "#foo/bar-baz" });
                    });
                    test('fails when it finds invalid character in the split segments', () => {
                        lintAndExpectErrors(rule, { "foo" : "#foo/bar@#$/baz" }, ['alphadash']);
                    });
                });

                describe('when no split or omit argument are used', () => {
                    const rule = {
                        "name": "alphadash",
                        "object": "*",
                        "enabled": true,
                        "pattern": {
                            "property": "foo",
                            "value": "^[a-z0-9-]+$"
                        }
                    };

                    test('will allow the regex when its only alphadash', () => {
                        lintAndExpectValid(rule, { "foo": "foo-bar" });
                    });

                    test('errors when non alphadash characters show up', () => {
                        lintAndExpectErrors(rule, { "foo" : "foo/bar" }, ['alphadash']);
                    });
                });
            });

            describe('xor', () => {
                const rule = {
                    "name": "one-or-tother",
                    "object": "*",
                    "enabled": true,
                    "xor": ["a", "b"]
                };

                test('only allows a or b not both', () => {
                    lintAndExpectValid(rule, { "a": 1, "c": 2 });
                    lintAndExpectErrors(rule, { "a": 1, "b": 2 }, ['one-or-tother']);
                });
            });

            describe('not-equal', () => {
                const rule = {
                    "name": "not-equal",
                    "object": "*",
                    "enabled": true,
                    "notEqual": ["default", "example"]
                };

                test('if the fields don\'t exist, that\'s fine', () => {
                    const input = {};
                    lintAndExpectValid(rule, input);
                });

                test('fails when two properties are the same', () => {
                    const input = {
                        "default": "foo",
                        "example": "foo"
                    };
                    lintAndExpectErrors(rule, input, ['not-equal']);
                });

                test('passes when two properties are different', () => {
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
