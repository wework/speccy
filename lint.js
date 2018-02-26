#!/usr/bin/env node

'use strict'

const fs = require('fs');
const yaml = require('js-yaml');
const fetch = require('node-fetch');

const resolver = require('./lib/resolver.js');
const linter = require('./lib/linter.js');
const validator = require('./lib/validate.js');

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

const options = {
    cache: [],
    status: 'undefined'
};

const lintResolvedSchema = options => {
    validator.validate(options.openapi, options, function(err, options) {

        if (err) {
            console.log(colors.red + 'Specification schema is invalid.' + colors.reset);
            formatSchemaError(err, options.context);
            process.exitCode = 1;
            return;
        }

        const lintResults = options.lintResults;
        if (lintResults.length) {
            console.log(colors.red + 'Specification contains lint errors: ' + lintResults.length + colors.reset);
            formatLintResults(lintResults);
            process.exitCode = lintResults.length;
            return;
        }

        console.log(colors.green + 'Specification is valid' + colors.reset)
        process.exitCode = 0;
    });
};

const formatSchemaError = (err, context) => {
  const pointer = context.pop();
  const message = err.message;
  let output;

    output = `
${colors.red + pointer} ${colors.reset + message}
`;

  console.log(output);

  if (err.stack && err.name !== 'AssertionError') {
      console.log(colors.red + err.stack + colors.reset);
  }
}

const formatLintResults = (lintResults) => {
    let output='';
    lintResults.forEach(result => {
        const { rule, error, pointer } = result;

        output += `
${colors.yellow + pointer} ${colors.cyan} R: ${rule.name} ${colors.white} D: ${rule.description}
${colors.reset + error.message}
`;
    });
    console.log(output);
}

const main = (str, callback) => {
    options.openapi = yaml.safeLoad(str,{json:true});
    resolver.resolve(options)
    .then(function() {
        options.status = 'resolved';
        callback(options);
    })
    .catch(function(err) {
        options.status = 'rejected';
        console.warn(err);
    });
};

const command = (file, cmd) => {

  linter.loadRules(cmd.rules, cmd.skip);

  if (file && file.startsWith('http')) {
      console.log('GET ' + file);
      fetch(file, {agent:options.agent}).then(function (res) {
          if (res.status !== 200) throw new Error(`Received status code ${res.status}`);
          return res.text();
      }).then(function (body) {
          main(body, lintResolvedSchema);
      }).catch(function (err) {
          console.warn(err);
      });
  }
  else {
      fs.readFile(file,'utf8',function(err,data){
          if (err) {
              console.warn(err);
              return
          }
          main(data, lintResolvedSchema);
      });
  }

};

module.exports = { command }
