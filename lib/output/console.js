const colors = process.env.NODE_DISABLE_COLORS ? {} : {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    reset: '\x1b[0m'
};

const formatSchemaError = (err, context) => {
    const pointer = context.pop();
    let output = `
${colors.yellow + pointer}
`;
    
    if (err.name === 'AssertionError' || err.error.name === 'AssertionError') {
        output += colors.reset + truncateLongMessages(err.message);
    }
    else if (err instanceof validator.CLIError) {
        output += colors.reset + err.message;
    }
    else {
        output += colors.red + err.stack;
    }
    return output;
}

const truncateLongMessages = message => {
    let lines = message.split('\n');
    if (lines.length > 6) {
        lines = lines.slice(0, 5).concat(
            ['  ... snip ...'],
            lines.slice(-1)
        );
    }
    return lines.join('\n');
}

const formatLintResults = lintResults => {
    let output = '';
    lintResults.forEach(result => {
        const { rule, error, pointer } = result;

        output += `
${colors.yellow + pointer} ${colors.cyan} R: ${rule.name} ${colors.white} D: ${rule.description}
${colors.reset + truncateLongMessages(error.message)}

More information: ${rule.url}#${rule.name}
`;
    });

    return output;
}

const render = (error, warnings, valid, context, quiet) => {
    if (error && valid === false) {
        console.error(colors.red + 'Specification schema is invalid.' + colors.reset);
        if (error.name === 'AssertionError') {
            console.error(formatSchemaError(error, context));
        }
    
        for (let linterResult of error.options.linterResults()) {
            console.error(formatSchemaError(linterResult, context));
        };
    }

    if (warnings.length) {
        console.error(colors.red + 'Specification contains lint errors: ' + warnings.length + colors.reset);
        console.warn(formatLintResults(warnings))
    }

    if(!error && warnings.length === 0) {
        if (!quiet) {
            console.log(colors.green + 'Specification is valid, with 0 lint errors' + colors.reset);
        }
    }
}

module.exports = {
    render: render
 };