'use strict';

const fs = require('fs');
const path = require('path');
const should = require('should');
const linter = require('../lib/linter.js');

function testFixtures(fixtures) {
    fixtures.forEach((fixture) => {
        const { object, tests } = fixture;
        describe('linting the ' + object + " object", () => {
            tests.forEach((test) => {
                if (test.expectValid) {
                    it('is valid', (done) => {
                        linter.lint(object, test['input']); // will not raise
                        done();
                    });
                }
                else {
                    it('throws error', (done) => {
                        (() => linter.lint(object, test['input'])).should.throw(test['error']);
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
            linter.loadRules(profile.rules, profile.skip);
            testFixtures(profile.fixtures);
        })
    })
});
