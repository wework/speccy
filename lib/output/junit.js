const renderIssue = validation => {
    let content = `\t\t<testcase name="${validation.ruleDescription}" classname="${validation.className}" assertions="1">\n`;
    content += `\t\t\t<failure message="${validation.ruleDescription}"></failure>\n`;
    content += '\t\t</testcase>\n';

    return content;
};

const render = (error, warnings, valid, context, quiet, numberOfRules) => {
    const results = error.options.linterResults();
    let testSuites = [];

    results.forEach(validation => {
        let x = validation.pointer.replace('#/paths/', '');
        let pos = x.indexOf('/');
        let method = x.substring(pos+1);
        if(method.indexOf('/') > 0) {
            method = method.substring(0, method.indexOf('/'));
        }
        
        validation.method = method;
        validation.nicePointer = method.toUpperCase() + ' ' + x.substring(0, pos).split('~1').join('/');

        const testSuiteName = validation.nicePointer;

        if(testSuites[testSuiteName] === undefined) {
            testSuites[testSuiteName] = {
                name: testSuiteName,
                testCases: []
            };
        }

        testSuites[testSuiteName].testCases.push({
            name: validation.rule.name,
            className: validation.pointer.substring(8).replace(/~1/g, "/"),
            message: validation.message,
            ruleDescription: validation.rule.description
        });
    });

    let xmlContent = '<?xml version="1.0" encoding="utf-8"?>\n';
    xmlContent += `<testsuites>\n`;

    Object.keys(testSuites).forEach(key => {
        let testSuite = testSuites[key];
        
        xmlContent += `\t<testsuite name="${testSuite.name}" tests="${numberOfRules}" failures="${testSuite.testCases.length}">\n`;

        testSuite.testCases.forEach(function(testCase) {
            xmlContent += renderIssue(testCase);
        });
        
        xmlContent += '\t</testsuite>\n';
    });
    
    xmlContent += '</testsuites>\n';

    return xmlContent;
};

module.exports = {
    render: render
};
