const renderIssue = validation => {
    return `<error line="0" severity="error" message="${validation.message}" source="${validation.ruleName}" />\n`;
};

const render = (error, warnings, valid, context, quiet) => {
    let xmlContent = '<xml version="1.0" encoding="utf-8"?>\n';
    xmlContent += '<checkstyle version="1.0">\n';
    xmlContent += `<file name="${error.options.openapi.info.title}">\n`;

    const results = error.options.linterResults();

    for (let i = 0; i < results.length; i++) 
    {
        xmlContent += renderIssue(results[i]);
    }

    xmlContent += '</file>\n';
    xmlContent += '</checkstyle>\n';

    return xmlContent;
};

module.exports = {
    render: render
};
