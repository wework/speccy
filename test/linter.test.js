'use strict';

const fs = require('fs');
const path = require('path');
const should = require('should');
const linter = require('../lib/linter.js');

function testProfile(profile) {

    profile.fixtures.forEach((fixture) => {
        const { object, tests } = fixture;
        describe('linting the ' + object + " object", () => {
            tests.forEach((test) => {
                var options = {lintResults: []};
                if (test.expectValid) {
                    it('is valid', (done) => {
                        linter.loadRules(profile.rules, test.skip);
                        linter.lint(object, test['input'], options);
                        options.lintResults.should.be.empty();
                        done();
                });
                } else {
                    it('is not valid', (done) => {
                        linter.loadRules(profile.rules, test.skip);
                        linter.lint(object, test['input'], options);
                        options.lintResults.should.not.be.empty();
                        done();
                    });
                }
            });
        });
    });
}

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
