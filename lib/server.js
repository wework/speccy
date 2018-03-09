'use strict';

const ejs = require('ejs');
const fs = require('fs');
const path = require('path');

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

module.exports = { loadHTML };
