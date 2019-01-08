'use strict';

let activeRules = {};
let skipRules = [];

const init = (params = {}) => {
    activeRules = {};
    skipRules = params.skip || [];
};

const createNewRules = rules => {
    rules.forEach(rule => createNewRule(rule));
};

const createNewRule = rule => {
    if (rule.disabled === true) return;
    // @DEPRECATED in v0.9.0, use `disabled: true`
    if (rule.enabled === false) return;
    activeRules[rule.name] = rule;
}

const getRules = () => {
    return {
        "rules": relevantRules(Object.values(activeRules), skipRules)
    };
}

const relevantRules = (rulesList, skipList) => {
    if (skipList.length === 0) return rulesList;
    return rulesList.filter(rule => skipList.indexOf(rule.name) === -1);
}

module.exports = {
    createNewRule,
    createNewRules,
    init,
    getRules
};
