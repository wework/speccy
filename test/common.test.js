'use strict';

const common = require('../lib/common.js');

describe('Common', () => {
    describe('hasDuplicates()', () => {
        it('considers [a, b, c] to not contain duplicates', () => {
            should(common.hasDuplicates(['a', 'b', 'c'])).be.eql(false);
        });
        it('considers [a, b, b] to comtain duplicates', () => {
            should(common.hasDuplicates(['a', 'b', 'b'])).be.eql(true);
        });
    });
});
