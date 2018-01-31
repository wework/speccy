#!/usr/bin/env node

// @ts-check
'use strict';

const fs = require('fs');
const path = require('path');
const util = require('util');
const readfiles = require('node-readfiles');
const yaml = require('js-yaml');

const common = require('./common.js');
const swagger2openapi = require('./index.js');
const validator = require('./validate.js');

var globalExpectFailure = false;

var argv = require('yargs')
    .usage('testRunner [options] [{path-to-specs}...]')
    .string('encoding')
    .alias('e', 'encoding')
    .default('encoding', 'utf8')
    .describe('encoding', 'encoding for input/output files')
    .string('fail')
    .describe('fail', 'path to specs expected to fail')
    .alias('f', 'fail')
    .string('jsonschema')
    .alias('j', 'jsonschema')
    .describe('jsonschema', 'path to alternative JSON schema')
    .boolean('laxurls')
    .alias('l', 'laxurls')
    .describe('laxurls', 'lax checking of empty urls')
    .boolean('lint')
    .describe('lint','lint the definition')
    .boolean('nopatch')
    .alias('n', 'nopatch')
    .describe('nopatch', 'do not patch minor errors in the source definition')
    .boolean('output')
    .alias('o', 'output')
    .describe('output', 'output conversion as openapi.yaml')
    .boolean('quiet')
    .alias('q', 'quiet')
    .describe('quiet', 'do not show test passes on console, for CI')
    .boolean('resolve')
    .alias('r', 'resolve')
    .describe('resolve', 'resolve external references')
    .boolean('stop')
    .alias('s', 'stop')
    .describe('stop', 'stop on first error')
    .count('verbose')
    .alias('v', 'verbose')
    .describe('verbose', 'increase verbosity')
    .boolean('warnOnly')
    .describe('warnOnly','Do not throw on non-patchable errors')
    .boolean('whatwg')
    .alias('w', 'whatwg')
    .describe('whatwg', 'enable WHATWG URL parsing')
    .boolean('yaml')
    .alias('y', 'yaml')
    .describe('yaml', 'skip YAML-safe test')
    .help('h')
    .alias('h', 'help')
    .strict()
    .version()
    .argv;

const red = process.env.NODE_DISABLE_COLORS ? '' : '\x1b[31m';
const green = process.env.NODE_DISABLE_COLORS ? '' : '\x1b[32m';
const yellow = process.env.NODE_DISABLE_COLORS ? '' : '\x1b[33;1m';
const normal = process.env.NODE_DISABLE_COLORS ? '' : '\x1b[0m';

var pass = 0;
var fail = 0;
var failures = [];
var warnings = [];

var genStack = [];

var options = argv;
options.patch = !argv.nopatch;

function finalise(err, options) {
    if (!argv.quiet || err) {
        console.log(normal + options.file);
    }
    if (err) {
        console.log(red + options.context.pop() + '\n' + err.message);
        if (err.stack && err.name !== 'AssertionError') {
            console.log(err.stack);
        }
        if (options.lintRule && options.lintRule.description !== err.message) {
            console.warn(options.lintRule.description);
        }
        options.valid = !!options.expectFailure;
    }
    if (options.warnings) {
        for (var warning of options.warnings) {
            warnings.push(options.file + ' ' + warning);
        }
    }

    var src = options.original;
    var result = options.valid;

    if (!argv.quiet) {
        var colour = ((options.expectFailure ? !result : result) ? green : red);
        if (src && src.info) {
            console.log(colour + '  %s %s', src.info.title, src.info.version);
            console.log('  %s', src.swagger ? (src.host ? src.host : 'relative') : (src.servers && src.servers.length ? src.servers[0].url : 'relative'),normal);
        }
    }
    if (result) {
        pass++;
        if ((options.file.indexOf('swagger.yaml') >= 0) && argv.output) {
            let outFile = options.file.replace('swagger.yaml', 'openapi.yaml');
            let resultStr = yaml.safeDump(options.openapi, {lineWidth: -1});
            fs.writeFile(outFile, resultStr, argv.encoding);
        }
    }
    else {
        fail++;
        if (options.file != 'unknown') failures.push(options.file);
        if (argv.stop) process.exit(1);
    }
    genStackNext();
}

function handleResult(err, options) {
    var result = false;
    if (err) {
        options = err.options || { file: 'unknown', src: { info: { version: '', title: '' } } };
        options.context = [];
        options.warnings = [];
        options.expectFailure = globalExpectFailure;
        finalise(err,options);
    }
    else {
        result = options.openapi;
    }
    var resultStr = JSON.stringify(result);

    if (typeof result !== 'boolean') try {
        if (!options.yaml) {
            resultStr = yaml.safeDump(result, { lineWidth: -1 }); // should be representable safely in yaml
            let resultStr2 = yaml.safeDump(result, { lineWidth: -1, noRefs: true });
            resultStr.should.not.be.exactly('{}','Result should not be empty');
            resultStr.should.equal(resultStr2,'Result should have no object identity ref_s');
        }

        validator.validate(result, options, finalise);
    }
    catch (ex) {
        console.log(normal + options.file);
        console.log(red + options.context.pop() + '\n' + ex.message);
        if (ex.stack && ex.name !== 'AssertionError') {
            console.log(ex.stack);
        }
        options.valid = !options.expectFailure;
        finalise(ex, options);
    }
}

function genStackNext() {
    if (!genStack.length) return false;
    var gen = genStack.shift();
    gen.next();
    return true;
}

function* check(file, force, expectFailure) {
    var result = false;
    options.context = [];
    options.expectFailure = expectFailure;
    options.file = file;
    var components = file.split(path.sep);
    var name = components[components.length - 1];

    if ((name.indexOf('.yaml') >= 0) || (name.indexOf('.json') >= 0) || force) {

        if (!file.startsWith('http')) {
            var srcStr = fs.readFileSync(path.resolve(file), options.encoding);
            var src;
            try {
                src = JSON.parse(srcStr);
            }
            catch (ex) {
                try {
                    src = yaml.safeLoad(srcStr, { schema: yaml.JSON_SCHEMA, json: true });
                }
                catch (ex) {
                    var warning = 'Could not parse file ' + file + '\n' + ex.message;
                    console.log(red + warning);
                    warnings.push(warning);
                }
            }

            if (!src || ((!src.swagger && !src.openapi))) {
                genStackNext();
                return true;
            }
        }

        options.original = src;
        options.source = file;

        if ((options.source.indexOf('!')>=0) && (options.source.indexOf('swagger.')>=0)) {
            expectFailure = true;
        }

        if (file.startsWith('http')) {
            swagger2openapi.convertUrl(file, common.clone(options))
            .then(function(options){
                handleResult(null,options);
            })
            .catch(function(ex){
                console.warn(red+ex,normal);
                if (expectFailure) {
                    warnings.push('Converter failed ' + options.source);
                }
                else {
                    failures.push('Converter failed ' + options.source);
                    fail++;
                }
                genStackNext();
                result = false;
            });
        }
        else {
            swagger2openapi.convertObj(src, common.clone(options))
            .then(function(options){
                handleResult(null,options);
            })
            .catch(function(ex){
                console.warn(red+ex,normal);
                if (expectFailure) {
                    warnings.push('Converter failed ' + options.source);
                }
                else {
                    failures.push('Converter failed ' + options.source);
                    fail++;
                }
                genStackNext();
                result = false;
            });
        }
    }
    else {
        genStackNext();
        result = true;
    }
    return result;
}

function processPathSpec(pathspec, expectFailure) {
    globalExpectFailure = expectFailure;
    if (pathspec.startsWith('@')) {
        pathspec = pathspec.substr(1, pathspec.length - 1);
        var list = fs.readFileSync(pathspec, 'utf8').split('\r').join('').split('\n');
        for (var file of list) {
            genStack.push(check(file, false, expectFailure));
        }
        genStackNext();
    }
    else if (pathspec.startsWith('http')) {
        genStack.push(check(pathspec, true, expectFailure));
        genStackNext();
    }
    else if (fs.statSync(path.resolve(pathspec)).isFile()) {
        genStack.push(check(pathspec, true, expectFailure));
        genStackNext();
    }
    else {
        readfiles(pathspec, { readContents: false, filenameFormat: readfiles.FULL_PATH }, function (err) {
            if (err) console.log(util.inspect(err));
        })
        .then(files => {
            files = files.sort();
            for (var file of files) {
                genStack.push(check(file, false, expectFailure));
            }
            genStackNext();
        })
        .catch(err => {
            console.log(util.inspect(err));
        });
    }
}

process.exitCode = 1;
console.log('Gathering...');
if ((!argv._.length) && (!argv.fail)) {
    argv._.push('../openapi-directory/APIs/');
}
for (let pathspec of argv._) {
    processPathSpec(pathspec, false);
}
if (argv.fail) {
    if (!Array.isArray(argv.fail)) argv.fail = [argv.fail];
    for (let pathspec of argv.fail) {
        processPathSpec(pathspec, true);
    }
}

process.on('unhandledRejection', r => console.warn(r));

process.on('exit', function () {
    if (warnings.length) {
        warnings.sort();
        console.log(normal + '\nWarnings:' + yellow);
        for (var w in warnings) {
            console.log(warnings[w]);
        }
    }
    if (failures.length) {
        failures.sort();
        console.log(normal + '\nFailures:' + red);
        for (var f in failures) {
            console.log(failures[f]);
        }
    }
    console.log(normal);
    console.log('Tests: %s passing, %s failing, %s warnings', pass, fail, warnings.length);
    process.exitCode = ((fail === 0) && (pass > 0)) ? 0 : 1;
});
