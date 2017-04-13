# swagger2openapi

![logo](https://github.com/Mermade/swagger2openapi/blob/master/docs/logo.png?raw=true)

[![OpenAPI Validation](https://openapi-converter.herokuapp.com/api/v1/badge?url=https://openapi-converter.herokuapp.com/examples/openapi.json)](https://openapi-converter.herokuapp.com/api/v1/validate?url=https://openapi-converter.herokuapp.com/examples/openapi.json)
![Build](https://img.shields.io/travis/Mermade/swagger2openapi.svg)
[![Tested on APIs.guru](https://api.apis.guru/badges/tested_on.svg)](https://APIs.guru)
[![Tested on Mermade OpenAPIs](https://img.shields.io/badge/Additional%20Specs-882-brightgreen.svg)](https://github.com/mermade/openapi-definitions)
[![Coverage Status](https://coveralls.io/repos/github/Mermade/swagger2openapi/badge.svg?branch=master)](https://coveralls.io/github/Mermade/swagger2openapi?branch=master)
[![Known Vulnerabilities](https://snyk.io/test/npm/swagger2openapi/badge.svg)](https://snyk.io/test/npm/swagger2openapi)

Convert Swagger 2.0 definitions into OpenApi 3.0.x

Currently tracking [v3.0.0-RC1](https://github.com/OAI/OpenAPI-Specification/blob/OpenAPI.next/versions/3.0.md)

Usage:

````
swagger2openapi [options] [filename|url]
Options:
  -c, --components  output information to unresolve a definition       [boolean]
  -d, --debug       enable debug mode, adds specification-extensions   [boolean]
  -e, --encoding    encoding for input/output files   [string] [default: "utf8"]
  -h, --help        Show help                                          [boolean]
  -o, --outfile     the output file to write to                         [string]
  -p, --patch       fix up small errors in the source definition       [boolean]
  -r, --resolve     resolve external references                        [boolean]
  -u, --url         url of original spec, creates x-origin entry        [string]
  -v, --verbose     increase verbosity                                   [count]
  -y, --yaml        read and write YAML, default JSON                  [boolean]
````

or use the APIs:

````javascript
var converter = require('swagger2openapi');
var options = {};
//options.debug = true; // sets various x-s2o- debugging properties
converter.convertObj(swagger, options, function(err, options){
  // options.openapi contains the converted definition
});
// also available are asynchronous convertFile, convertUrl, convertStr and convertStream functions
// if you omit the callback parameter, you will instead receive a Promise
````

````javascript
var validator = require('swagger2openapi/validate.js');
var options = {};
validator.validate(openapi, options, function(err, options){
  // options.valid contains the result of the validation
  // options.context now contains a stack (array) of JSON-Pointer strings
});
// also available is a synchronous validateSync method which returns a boolean
````

See here for complete [documentation](docs/options.md) of the `options` object.

Or use the [online version](https://openapi-converter.herokuapp.com) which also includes its own [API](http://petstore.swagger.io/?url=https://openapi-converter.herokuapp.com/contract/swagger.json).

## Features

### OpenAPI 3.0.x validation

The `testRunner` harness can also be used as a simple validator if given one or more existing OpenAPI 3.x definitions. The validator (however it is called) uses [WHATWG](https://whatwg.org/) URL parsing if available (node 7.x and above).

### Reference preservation

swagger2openapi preserves `$ref` JSON references in your API definition, and does not dereference
every item, as with some model-based parsers.

### Specification extensions

swagger2openapi has support for a limited number of real-world [specification extensions](/docs/extensions.md) which have a direct bearing on the conversion. All other specification extensions are left untouched. swagger2openapi is [swaggerplusplus](https://github.com/mermade/swaggerplusplus)-compatible.

It is expected to be able to configure the process of specification-extension modification using options or a plugin mechanism in a future release.

## Tests

To run a test-suite:

````shell
node testRunner [-f {path-to-expected-failures}]... [{path-to-APIs|single-file...}]
````

The test harness currently expects files with a `.json` or `.yaml` extension, or a single named file, and has been tested on Node.js versions 4.x, 6.x and 7.x against

* [APIs.guru](https://github.com/APIs-guru/openapi-directory)
* [Mermade OpenApi specifications collection](https://github.com/mermade/openapi_specifications)
* [SOM-Research collection](https://github.com/SOM-Research/hapi)

Additionally swagger2openapi has been tested on a corpus of 34,679 real-world valid Swagger 2.0 definitions from GitHub and [SwaggerHub](https://swaggerhub.com/). However, if you have a definition which causes errors in the converter or does not pass validation, please do not hesitate to [raise an issue](https://github.com/Mermade/swagger2openapi/issues).


## License 

[BSD-3-Clause](LICENSE) except the OpenAPI3 schema, which is originally from [Google Gnostic](https://github.com/googleapis/gnostic/blob/master/OpenAPIv3/openapi-3.0.json) and is licensed under the [Apache-2](https://github.com/googleapis/gnostic/blob/master/LICENSE) license.
