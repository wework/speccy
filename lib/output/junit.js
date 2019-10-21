const renderIssue = validation => {
    let content = `<testcase name="${validation.name}" classname="${validation.className}" assertions="1">\n`;
    content += `    <failure message="${validation.ruleDescription}"><![CDATA[${validation.message}]]></failure>\n`;
    content += '</testcase>\n';

    return content;
};

const render = (error, warnings, valid, context, quiet) => {
    const results = error.options.linterResults();
    let testSuites = [];

    results.forEach(validation => {
        const testSuiteName = validation.rule.url;

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

    let xmlContent = '<xml version="1.0" encoding="utf-8"?>\n';
    xmlContent += `<testsuites>\n`;

    Object.keys(testSuites).forEach(key => {
        let testSuite = testSuites[key];
        
        xmlContent += `<testsuite name="${testSuite.name}" tests="${results.length}" failures="${results.length}">\n`;

        testSuite.testCases.forEach(function(testCase) {
            xmlContent += renderIssue(testCase);
        });
        
        xmlContent += '</testsuite>\n';
    });
    
    xmlContent += '</testsuites>\n';

    return xmlContent;
};

module.exports = {
    render: render
};
