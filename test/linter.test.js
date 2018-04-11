'use strict';

const fs = require('fs');
const path = require('path');
const loader = require('../lib/loader.js');
const linter = require('../lib/linter.js');

const runLinter = (object, input) => {
    return linter.lint(object, input).catch(err => { console.log('is it this') });
}

const getLinterErrors = async (linter) => {
    return (await linter).map(result => result.rule.name);
}

function testProfile(profile) {
    profile.fixtures.forEach(fixture => {
        const { object, tests } = fixture;
        describe(`linting the ${object} object`, () => {
            tests.forEach(async test => {
                const { input, expectedRuleErrors, expectValid, skip = [] } = test;

                await loader.loadRuleFiles(profile.rules, { skip });
                const results = await getLinterErrors(runLinter(object, input));

                if (expectValid) {
                    it(JSON.stringify(input) + ' is valid', () => {
                        results.should.be.empty();
                    });
                }
                else {
                    it(JSON.stringify(input) + ' is not valid', () => {
                        results.should.be.deepEqual(expectedRuleErrors);
                    });
                }
            });
        });
    });
}

describe('linter.js', () => {
    describe('lint()', () => {
        const profilesDir = path.join(__dirname, './profiles/');

        fs.readdirSync(profilesDir).forEach(function (file) {
            const profile = JSON.parse(fs.readFileSync(profilesDir + file, 'utf8'))
            const profileName = file.replace(path.extname(file), '')

            context('when `' + profileName + '` profile is loaded', () => {
                testProfile(profile);
            });
        })

        context('when rules are manually passed', () => {
            const lintAndExpectErrors = async (rule, input, expectedErrors) => {
                linter.initialize();
                linter.createNewRule(rule);
                (await getLinterErrors(runLinter('something', input))).should.be.deepEqual(expectedErrors);
            }

            const lintAndExpectValid = async (rule, input) => {
                linter.initialize();
                linter.createNewRule(rule);
                const lint = runLinter('something', input);
                // rejections are bad
                lint.should.not.be.rejected();
                // dont want any linter errors either
                (await getLinterErrors(lint)).should.be.empty();
            }

            context('alphabetical', () => {
                const rule = {
                    "name": "alphabetical-name",
                    "object": "*",
                    "enabled": true,
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

                    lintAndExpectErrors(rule, input, ['alphabetical-name'])
                });
            });

            context('maxLength', () => {
                const rule = {
                    "name": "gotta-be-five",
                    "object": "*",
                    "enabled": true,
                    "maxLength": { "property": "summary", "value": 5 }
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

            context('properties', () => {
                const rule = {
                    "name": "exactly-two-things",
                    "object": "*",
                    "enabled": true,
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
                        "enabled": true,
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
                        "enabled": true,
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
                    "enabled": true,
                    "xor": ["a", "b"]
                };

                it('only allows a or b not both', () => {
                    lintAndExpectValid(rule, { "a": 1, "c": 2 });
                    lintAndExpectErrors(rule, { "a": 1, "b": 2 }, ['one-or-tother']);
                });
            });
        });
    });
});
