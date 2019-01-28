'use strict';

const documentationUrl = 'https://speccy.io/rules/1-rulesets';
let activeRules = {};
let skipRules = [];

const init = (params = {}) => {
    activeRules = {};
    skipRules = params.skip || [];
};

const createNewRules = (rules, rulesetDocumentationUrl) => {
    rules.forEach(rule => createNewRule(rule, rulesetDocumentationUrl));
};

const createNewRule = (rule, rulesetDocumentationUrl) => {
    if (rule.disabled === true) {
        delete activeRules[rule.name];
        return;
    }
    // @DEPRECATED in v0.9.0, use `disabled: true`
    if (rule.enabled === false) {
        delete activeRules[rule.name];
        return;
    }

    if (!rule.url) rule.url = (rulesetDocumentationUrl) ? rulesetDocumentationUrl : documentationUrl;

    activeRules[rule.name] = rule;
};

const getRules = () => {
    return {
        "rules": relevantRules(Object.values(activeRules), skipRules)
    };
};

const relevantRules = (rulesList, skipList) => {
    if (skipList.length === 0) return rulesList;
    return rulesList.filter(rule => skipList.indexOf(rule.name) === -1);
};

module.exports = {
    createNewRule,
    createNewRules,
    init,
    getRules
};
