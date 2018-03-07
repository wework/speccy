'use strict';

const ejs = require('ejs');
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

class ExtendableError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}

class OpenError extends ExtendableError {}
class ReadError extends ExtendableError {}

function loadSpec(path) {
    let fileContents, yml;
    try {
        fileContents = fs.readFileSync(path, 'utf8');
    }
    catch (e) {
        throw new OpenError(e.message);
    }
    try {
        yml = yaml.load(fileContents);
    }
    catch (e) {
        throw new ReadError(e.message);
    }
    return JSON.stringify(yml);
}

function loadHTML(file) {
    try {
        const templateFile = path.resolve(__dirname, '../templates/index.html');
        const template = fs.readFileSync(templateFile, 'utf8');
        return ejs.render(template, { spec: file });
    }
    catch (e) {
        console.error('failed to load html file: ' + e.message);
        process.exit(1);
    }
}

module.exports = {
    loadSpec,
    loadHTML
};
