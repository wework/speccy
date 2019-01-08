'use strict';

const rules = require('../lib/rules.js');
const should = require('should');

describe('Rules', () => {
    describe('createNewRule()', () => {
        const activeRule = { name: "active-rule", disabled: false };
        const disabledRule = { name: "disabled-rule", disabled: true };
        const negativelyEnabledRule = { name: "negatively-enabled-rule", enabled: false };

        context('when creating a new rule', () => {
            it('accepts an active rule', () => {
                rules.init();
                rules.createNewRule(activeRule);
                rules.getRules().rules.should.be.lengthOf(1);
            });

            it('skips a disabled rule', () => {
                rules.init();
                rules.createNewRule(disabledRule);
                rules.getRules().rules.should.be.lengthOf(0);
            });

            it('skips a disabled rule via enabled:false', () => {
                rules.init();
                rules.createNewRule(negativelyEnabledRule);
                rules.getRules().rules.should.be.lengthOf(0);
            });

        });

        context('when skipping rules', () => {
            it('passed thru rule is skipped', () => {
                rules.init({ skip: ['active-rule'] });
                rules.createNewRule(activeRule);
                rules.getRules().rules.should.be.lengthOf(0);
            });
        });
    });
});
