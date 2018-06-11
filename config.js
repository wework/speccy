"use strict";

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const fs = require("fs"),
      path = require("path"),
      yamlParse = require("node-yaml-config"),
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

// Builds and returns config object if config file found
// NOTE: function may not be necessary
function getConfig() {
  if (fileExists()) {
    var config = yaml.safeLoad(fs.readFileSync(filePath, 'utf8'), { json: true });
    return config;
  }
}

// Returns array of rules file locations(s) from config file
// function getConfigRules() {
//  let config = [];
//  for each rules config.push(rule)
//  return config
// }

module.exports = {
  fileExists,
  getConfig
};
