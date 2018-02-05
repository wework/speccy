#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const util = require('util');

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
  reset: '\x1b[0m',
};

var pass = 0;
var fail = 0;

const options = {
  status: 'undefined'
};

const lintResolvedSchema = (options) => {
    validator.validate(options.openapi, options, function(err, options) {
        if (!err) {
          console.log('File is valid')
          process.exitCode = 0;
          return;
        }

        formatLinterError(err, options.context, options.lintRule);
        options.valid = !!options.expectFailure;
        process.exitCode = 1;
    });
};

const formatLinterError = (err, context, rule) => {
  const pointer = context.pop();
  const message = err.message;
  const output = `
  ${colors['yellow'] + pointer} ${colors['cyan']} R: ${rule.name} ${colors['white']} D: ${rule.description}

  ${colors['reset'] + message}
  `

  console.log(output);

  if (err.stack && err.name !== 'AssertionError') {
      console.log(colors['red'] + err.stack);
  }
}

const resolveSchema = (str, callback) => {
    options.openapi = yaml.safeLoad(str,{json:true});
    resolver.resolve(options)
    .then(function(){
        options.status = 'resolved';
        callback(options)
    })
    .catch(function(err){
        options.status = 'rejected';
        console.warn(err);
    });
};

// TODO Sort out multiple formats. Rubocop has some cool ones
// -f, --format FORMATTER           Choose an output formatter. This option
//                                  can be specified multiple times to enable
//                                  multiple formatters at the same time.
//                                    [p]rogress (default)
//                                    [s]imple
//                                    [c]lang
//                                    [d]isabled cops via inline comments
//                                    [fu]ubar
//                                    [e]macs
//                                    [j]son
//                                    [h]tml
//                                    [fi]les
//                                    [o]ffenses
//                                    [w]orst
//                                    [t]ap
//                                    [q]uiet

const command = (file, cmd) => {

  linter.loadRules(cmd.rules);

  if (file && file.startsWith('http')) {
      console.log('GET ' + file);
      fetch(file, {agent:options.agent}).then(function (res) {
          if (res.status !== 200) throw new Error(`Received status code ${res.status}`);
          return res.text();
      }).then(function (body) {
          resolveSchema(body, lintResolvedSchema);
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
          resolveSchema(data, lintResolvedSchema);
      });
  }

};

module.exports = { command }
