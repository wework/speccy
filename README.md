# swagger2openapi

![logo](https://github.com/Mermade/swagger2openapi/blob/master/docs/logo.png?raw=true)

[![OpenAPI Validation](https://openapi-converter.herokuapp.com/api/v1/badge?url=https://openapi-converter.herokuapp.com/examples/openapi.json)](https://openapi-converter.herokuapp.com/api/v1/validate?url=https://openapi-converter.herokuapp.com/examples/openapi.json)
![Build](https://img.shields.io/travis/Mermade/swagger2openapi.svg)
[![Tested on APIs.guru](https://api.apis.guru/badges/tested_on.svg)](https://APIs.guru)
[![Tested on Mermade OpenAPIs](https://img.shields.io/badge/Additional%20Specs-1258-brightgreen.svg)](https://github.com/mermade/openapi-definitions)
[![Coverage Status](https://coveralls.io/repos/github/Mermade/swagger2openapi/badge.svg?branch=master)](https://coveralls.io/github/Mermade/swagger2openapi?branch=master)
[![Known Vulnerabilities](https://snyk.io/test/npm/swagger2openapi/badge.svg)](https://snyk.io/test/npm/swagger2openapi)

Convert Swagger 2.0 definitions into OpenApi 3.0.x

Currently tracking [v3.0.0-RC0](https://github.com/OAI/OpenAPI-Specification/blob/3.0.0-rc0/versions/3.0.md)

Usage:

````
swagger2openapi [options] [filename|url]
Options:
  -d, --debug    enable debug mode, adds specification-extensions      [boolean]
  -e, --encoding encoding for input/output files      [string] [default: "utf8"]
  -h, --help     Show help                                             [boolean]
  -o, --outfile  the output file to write to                            [string]
  -p, --patch    fix up small errors in the source definition          [boolean]
  -u, --url      url of original spec, creates x-origin entry           [string]
  -y, --yaml     read and write YAML, default JSON                     [boolean]
````

or use the APIs:

````javascript
var converter = require('swagger2openapi');
var options = {};
//options.debug = true; // sets various x-s2o- debugging properties
var openapi = converter.convertSync(swagger, options);
// also available are asynchronous convertObj, convertFile, convertUrl and convertStr functions
````

````javascript
var validator = require('swagger2openapi/validate.js');
var options = {};
var result = validator.validate(openapi, options); // returns boolean, throws on error
// options.context now contains a stack (array) of JSON-Pointer strings
````

Or use the [online version](https://openapi-converter.herokuapp.com) which also includes its own [API](http://petstore.swagger.io/?url=https://openapi-converter.herokuapp.com/contract/swagger.json).

## Specification extensions

swagger2openapi has support for a limited number of real-world specification extensions which have a direct bearing on the conversion. All other specification extensions are left untouched.

Specification Extension|Vendor|Conversion Performed
|---|---|---|
x-ms-paths|[Microsoft](https://github.com/Azure/autorest/tree/master/docs/extensions)|Treated as an analogue of the `openapi.paths` object
x-ms-skip-url-encoding|[Microsoft](https://github.com/Azure/autorest/tree/master/docs/extensions)|For query parameters, converted to `allowReserved:true`
x-ms-odata|[Microsoft](https://github.com/Azure/autorest/tree/master/docs/extensions)|References to `#/definitions/` are updated to `#/components/schemas`
x-ms-parameterized-host|[Microsoft](https://github.com/Azure/autorest/tree/master/docs/extensions)|**TODO** Not seen in the wild
x-anyOf|[Open Nitro Project](https://github.com/mermade/bbcparse)|Within schemas, converted to `anyOf`
x-oneOf|[Open Nitro Project](https://github.com/mermade/bbcparse)|Within schemas, converted to `oneOf`
x-not|[Open Nitro Project](https://github.com/mermade/bbcparse)|Within schemas, converted to `not`

See also [Amazon API Gateway specification extensions](http://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-swagger-extensions.html)

It is expected to be able to configure the process of specification-extension modification using options or a plugin 
mechanism in a future release.

## Tests

To run a test-suite:

````shell
node testRunner [-f {path-to-expected-failures}]... [{path-to-APIs|single-file...}]
````

The test harness currently expects files with a `.json` or `.yaml` extension, or a single named file, and has been tested on Node.js versions 4.x, 6.x and 7.x against

* [APIs.guru](https://github.com/APIs-guru/openapi-directory)
* [Mermade OpenApi specifications collection](https://github.com/mermade/openapi_specifications)
* [SOM-Research collection](https://github.com/SOM-Research/hapi) (overlaps with APIs.guru)

It can also be used as a simple validator if given an existing OpenAPI 3.x definition. The validator (however it is called) uses [WHATWG](https://whatwg.org/) URL parsing if available (node 7.x and above).

## Metadata reporting

Also included is a tool `reportExtensions` to gather a list of specification (fka vendor) extensions and formats used in a definition or corpus of definitions. For examples of output, see the [wiki](https://github.com/mermade/swagger2openapi/wiki)
