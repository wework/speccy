'use strict';

const rules = require('../../lib/rules.js');

describe('Rules', () => {
    describe('createNewRule()', () => {
        const activeRule = { name: "active-rule", disabled: false };
        const disabledRule = { name: "disabled-rule", disabled: true };
        const negativelyEnabledRule = { name: "negatively-enabled-rule", enabled: false };

        describe('when creating a new rule', () => {
            test('accepts an active rule', () => {
                rules.init();
                rules.createNewRule(activeRule);
                expect(rules.getRules().rules).toHaveLength(1);
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
