'use strict';

const fs = require('fs');
const path = require('path');
const loader = require('../lib/loader.js');
const linter = require('../lib/linter.js');

function testProfile(profile) {
    profile.fixtures.forEach(fixture => {
        const { object, tests } = fixture;
        describe('linting the ' + object + " object", () => {
            tests.forEach(test => {
                const rules = loader.loadRules(profile.rules, test.skip);
                const options = { lintResults : []};

                linter.setRules(rules);
                linter.lint(object, test.input, options);

                if (test.expectValid) {
                    it(JSON.stringify(test.input) + ' is valid', done => {
                        options.lintResults.should.be.empty();
                        done();
                    });
                }
                else {
                    it(JSON.stringify(test.input) + ' is not valid', done => {
                        const actualRuleErrors = options.lintResults.map(result => result.rule.name);
                        test.expectedRuleErrors.should.deepEqual(actualRuleErrors);
                        done();
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

            context(`when \`${profileName}\` profile is loaded`, () => {
                testProfile(profile);
            });
        })

        context('when rules are manually passed', () => {

            const lintAndExpectErrors = (rule, input, expectedErrors) => {
                const options = { lintResults : []};
                linter.setRules([rule]);
                linter.lint('something', input, options);
                const ruleErrors = options.lintResults.map(result => result.rule.name);
                ruleErrors.should.deepEqual(expectedErrors);
            }

            const lintAndExpectValid = (rule, input) => {
                const options = { lintResults : []};
                linter.setRules([rule]);
                linter.lint('something', input, options);
                options.lintResults.should.be.empty;
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

                it('accepts key values in order', done => {
                    const input = {
                        "tags": [
                            {"name": "bar"},
                            {"name": "foo"}
                        ]
                    };
                    lintAndExpectValid(rule, input);
                    done();
                });

                it('fails key values out of order', done => {
                    const input = {
                        "tags": [
                            {"name": "foo"},
                            {"name": "bar"}
                        ]
                    };
                    lintAndExpectErrors(rule, input, ['alphabetical-name']);
                    done();
                });
            });

            context('maxLength', () => {
                const rule = {
                    "name": "gotta-be-five",
                    "object": "*",
                    "enabled": true,
                    "maxLength": { "property": "summary", "value": 5 }
                };

                it('accepts values up to the max length', done => {
                    const input = { summary: '12345' };
                    lintAndExpectValid(rule, input);
                    done();
                });

                it('errors when string is too long', done => {
                    const input = { summary: '123456' };
                    lintAndExpectErrors(rule, input, ['gotta-be-five']);
                    done();
                });
            });

            context('xor', () => {
                const rule = {
                    "name": "one-or-tother",
                    "object": "*",
                    "enabled": true,
                    "xor": ["a", "b"]
                };

                it('only allows a or b not both', done => {
                    lintAndExpectValid(rule, { "a": 1, "c": 2 });
                    lintAndExpectErrors(rule, { "a": 1, "b": 2 }, ['one-or-tother']);
                    done();
                });
            });
        });
    });
});
