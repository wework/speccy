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

            context('when `' + profileName + '` profile is loaded', () => {
                testProfile(profile);
            })
        })
    });
});
