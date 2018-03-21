'use strict';

const ejs = require('ejs');
const fs = require('fs');
const path = require('path');

function loadHTML(file) {
    const templateFile = path.resolve(__dirname, '../templates/index.html');
    const template = fs.readFileSync(templateFile, 'utf8');
    return ejs.render(template, { spec: file });
}

module.exports = { loadHTML };
