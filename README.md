# swagger2openapi

![logo](https://github.com/wework/speccy/blob/master/docs/logo.png?raw=true)

![Build](https://img.shields.io/travis/wework/speccy/master.svg)
[![Coverage Status](https://coveralls.io/repos/github/wework/speccy/badge.svg?branch=master)](https://coveralls.io/github/wework/speccy?branch=master)
[![Known Vulnerabilities](https://snyk.io/test/npm/speccy/badge.svg)](https://snyk.io/test/npm/speccy)

Enforce quality rules on your OpenApi 3.0.x specifications.

Currently tracking [v3.0.0](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.0.md)

**If you are using Node.js 4 - please use the --harmony flag**

Usage:

```
speccy [options] [filename|url]
Options:
  --version         Show version number                                [boolean]
  -d, --debug       enable debug mode, adds specification-extensions   [boolean]
  -e, --encoding    encoding for input/output files   [string] [default: "utf8"]
  -h, --help        Show help                                          [boolean]
  -r, --resolve     resolve external references                        [boolean]
  -u, --url         url of original spec, creates x-origin entry        [string]
  -v, --verbose     increase verbosity                                   [count]
  -y, --yaml        read and write YAML, default JSON                  [boolean]
```

or use the APIs:

```javascript
var converter = require('speccy');
var options = {};
//options.patch = true; // fix up small errors in the source definition
//options.warnOnly = true; // Do not throw on non-patchable errors
converter.lintObj(openapi, options, function(err, options){
  // not planned this yet
});
// also available are asynchronous lintFile, lintUrl, lintStr functions
// if you omit the callback parameter, you will instead receive a Promise
```

```javascript
var validator = require('swagger2openapi/validate.js');
var options = {};
validator.validate(openapi, options, function(err, options){
  // options.valid contains the result of the validation
  // options.context now contains a stack (array) of JSON-Pointer strings
});
// also available is a synchronous validateSync method which returns a boolean
```

See here for complete [documentation](/docs/options.md) of the `options` object.

### Browser Support

See [initial documentation](/docs/browser.md).

## Features

### OpenAPI 3.0.x validation

The `testRunner` harness can also be used as a simple validator if given one or more existing OpenAPI 3.x definitions. The validator (however it is called) uses [WHATWG](https://whatwg.org/) URL parsing if available (node 7.x and above). The testRunner can have a linting mode enabled with the `--lint` option. Rules are defined [here](/linter/rules.json). Contributions of rules and rule actions for the linter are very much appreciated.

## Tests

To run a test-suite:

```shell
node testRunner [-f {path-to-expected-failures}]... [{path-to-APIs|single-file...}]
```

The test harness currently expects files with a `.json` or `.yaml` extension, or a single named file, and has been tested on Node.js versions 4.x, 6.x and 8.x LTS (it is not recommended to run the test suite under Node.js versions >=7.0.0 and \<8.7.0 because of [this bug](https://github.com/nodejs/node/issues/13048)) against

* [APIs.guru](https://github.com/APIs-guru/openapi-directory)
* [Mermade OpenApi specifications collection](https://github.com/mermade/openapi_specifications)
* [OpenAPI3-Examples (pass/fail)](https://github.com/mermade/openapi3-examples)
* [SOM-Research collection](https://github.com/SOM-Research/hapi)

## License

[BSD-3-Clause](LICENSE) except the `openapi-3.0.json` schema, which is taken from the [OpenAPI-Specification](https://github.com/OAI/OpenAPI-Specification/blob/49e784d7b7800da8732103aa3ac56bc7ccde5cfb/schemas/v3.0/schema.yaml) and the alternative `gnostic-3.0.json` schema, which is originally from [Google Gnostic](https://github.com/googleapis/gnostic/blob/master/OpenAPIv3/openapi-3.0.json). Both of these are licensed under the [Apache-2](http://www.apache.org/licenses/LICENSE-2.0) license.
