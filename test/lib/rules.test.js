'use strict';

const rules = require('../../lib/rules.js');

let activeRule, disabledRule, negativelyEnabledRule;

beforeEach(() => {
    activeRule = { name: "active-rule", disabled: false };
    disabledRule = { name: "disabled-rule", disabled: true };
    negativelyEnabledRule = { name: "negatively-enabled-rule", enabled: false };
});

describe('Rules', () => {
    describe('createNewRule()', () => {
        describe('when creating a new rule', () => {
            test('accepts an active rule', () => {
                rules.init();
                rules.createNewRule(activeRule);
                expect(rules.getRules().rules).toHaveLength(1);
                expect(rules.getRules().rules[0].url).toBe('https://speccy.io/rules/1-rulesets');
            });

            test('skips a disabled rule', () => {
                rules.init();
                rules.createNewRule(disabledRule);
                expect(rules.getRules().rules).toHaveLength(0);
            });

            test('skips a disabled rule via enabled:false', () => {
                rules.init();
                rules.createNewRule(negativelyEnabledRule);
                expect(rules.getRules().rules).toHaveLength(0);
            });

            test('accepts an rule can override url', () => {
                rules.init();
                rules.createNewRule(activeRule, 'http://test');
                expect(rules.getRules().rules).toHaveLength(1);
                expect(rules.getRules().rules[0].url).toBe('http://test');
            });

            test('deletes a previously added rule if the overriding rule is disabled', () => {
                rules.init();

                rules.createNewRule(activeRule);
                expect(rules.getRules().rules).toHaveLength(1);

                // inheriting a rule with the same name but disabled
                rules.createNewRule(Object.assign({}, activeRule, {disabled: true}));
                expect(rules.getRules().rules).toHaveLength(0);
            });
        });

        describe('when skipping rules', () => {
            test('passed thru rule is skipped', () => {
                rules.init({ skip: ['active-rule'] });
                rules.createNewRule(activeRule);
                expect(rules.getRules().rules).toHaveLength(0);
            });
        });
    });
});
