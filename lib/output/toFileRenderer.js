const fs = require('fs');

const outputToFileRenderer = (renderer, outputFileName) => {
    return {
        render: (error, warnings, valid, context, quiet, numberOfRules) => {
            const output = renderer.render(error, warnings, valid, context, quiet, numberOfRules);

            fs.writeFileSync(
                outputFileName, 
                output);
        }
    };
}

module.exports = {
    outputToFileRenderer: outputToFileRenderer
};
