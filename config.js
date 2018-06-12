"use strict";

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const fs = require("fs"),
      path = require("path"),
      yaml = require('js-yaml');


//------------------------------------------------------------------------------
// Private
//------------------------------------------------------------------------------

const CONFIG_FILE = ".speccy.yml";
const filePath = path.join(__dirname + '/' + CONFIG_FILE);

//------------------------------------------------------------------------------
// Public Interface
//------------------------------------------------------------------------------

// Determines if config file exists
function fileExists() {
  if (fs.existsSync(filePath)) {
    return true;
  } else {
    return false;
  }
}

// Returns config object if config file found
function getConfigFile() {
  if (fileExists()) {
    var config = yaml.safeLoad(fs.readFileSync(filePath, 'utf8'), { json: true });
    return config;
  }
}

// Returns array of rules file(s) from config file
function getConfigRules() {
  const config = getConfigFile();
  let rulesFiles = [];

  config.lint.rules.forEach(function(rule) {
    rulesFiles.push(rule);
  });

  return rulesFiles
}

module.exports = {
  fileExists,
  getConfigFile,
  getConfigRules
};
