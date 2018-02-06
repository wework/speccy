'use strict';

const fs = require('fs');
const path = require('path');
const should = require('should');
const yaml = require('js-yaml');

const linter = require('../lib/linter.js');


describe('lint()', () => {

    context('when default profile is loaded', () => {
        linter.loadRules(['default']);

        const fixtures = [
            {
                object: 'openapi',
                tests: [
                    {
                        input: { openapi: 3 },
                        error: 'expected Object { openapi: 3 } to have property tags'
                    },
                    {
                        input: { openapi: 3, tags: [] },
                        error: 'expected Array [] not to be empty (false negative fail)'
                    },
                    {
                        input: { openapi: 3, tags: ['foo'] },
                        expectValid: true
                    }
                ]
            },
            {
                object: 'info',
                tests: [
                    {
                        input: {},
                        error: 'expected Object {} not to be empty (false negative fail)'
                    },
                    {
                        input: { contact: {} },
                        error: 'expected Object {} not to be empty (false negative fail)'
                    },
                    {
                        input: { contact: { foo: 'bar' } },
                        expectValid: true
                    }
                ]
            }
        ];

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
                            (() => linter.lint(object, test['input'])).should.throw(test['message']);
                            done();
                        });
                    }
                });
            });
        });
    });
});
