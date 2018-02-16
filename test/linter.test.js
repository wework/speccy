'use strict';

const fs = require('fs');
const path = require('path');
const should = require('should');
const yaml = require('js-yaml');

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
                        input: {
                            openapi: 3,
                            tags: [
                                {name: 'foo'},
                                {name: 'bar'}
                            ]
                        },
                        error: 'expected Array [ Object { name: \'foo\' }, Object { name: \'bar\' } ] to be Array [ Object { name: \'bar\' }, Object { name: \'foo\' } ]'
                    },
                    {
                        input: { openapi: 3, tags: [ {name: 'foo'} ] },
                        expectValid: true
                    }
                ]
            },
            {
                object: 'info',
                tests: [
                    {
                        input: {},
                        error: 'expected Object {} to have property contact'
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

        testFixtures(fixtures);
    });
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
                        input: {
                            openapi: 3,
                            tags: [
                                {name: 'foo'},
                                {name: 'bar'}
                            ]
                        },
                        error: 'expected Array [ Object { name: \'foo\' }, Object { name: \'bar\' } ] to be Array [ Object { name: \'bar\' }, Object { name: \'foo\' } ]'
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
                        error: 'expected Object {} to have property contact'
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

        testFixtures(fixtures);
    });
});
