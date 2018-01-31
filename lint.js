#!/usr/bin/env node

const fs = require('fs');
const util = require('util');

const yaml = require('js-yaml');
const fetch = require('node-fetch');

const common = require('./common.js');
const resolver = require('./resolver.js');
const validator = require('./validate.js');

const red = process.env.NODE_DISABLE_COLORS ? '' : '\x1b[31m';
const green = process.env.NODE_DISABLE_COLORS ? '' : '\x1b[32m';
const yellow = process.env.NODE_DISABLE_COLORS ? '' : '\x1b[33;1m';
const normal = process.env.NODE_DISABLE_COLORS ? '' : '\x1b[0m';

var pass = 0;
var fail = 0;
var failures = [];
var warnings = [];

const options = {
  status: 'undefined'
}

const lintResolvedSchema = (options) => {
    validator.validate(options.openapi, options, function(err, options) {
        if (err) {
            console.log(red + options.context.pop() + '\n' + err.message);
            if (err.stack && err.name !== 'AssertionError') {
                console.log(err.stack);
            }
            if (options.lintRule && options.lintRule.description !== err.message) {
                console.warn(options.lintRule.description);
            }
            options.valid = !!options.expectFailure;

            process.exitCode = 1;
            return;
        }

        console.log('File is valid')
        process.exitCode = 0;
    });
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
}

function lintCommand(file) {
  options['source'] = options['origin'] = file;

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

module.exports = {
  command: lintCommand
}
