# swagger2openapi

![logo](https://github.com/Mermade/swagger2openapi/blob/master/docs/logo.png?raw=true)

![Build](https://img.shields.io/travis/Mermade/swagger2openapi.svg) [![Tested on APIs.guru](https://api.apis.guru/badges/tested_on.svg)](https://APIs.guru) [![Tested on Mermade OpenAPIs](https://img.shields.io/badge/Additional%20Specs-1258-brightgreen.svg)](https://github.com/mermade/openapi_specifications)
[![Known Vulnerabilities](https://snyk.io/test/npm/swagger2openapi/badge.svg)](https://snyk.io/test/npm/swagger2openapi)

Convert Swagger 2.0 definitions into OpenApi 3.0.x

Currently tracking [v3.0.0-RC0](https://github.com/OAI/OpenAPI-Specification/blob/3.0.0-rc0/versions/3.0.md)

Usage:

````
Options:
  -d, --debug    enable debug mode, adds specification-extensions      [boolean]
  -h, --help     Show help                                             [boolean]
  -o, --outfile  the output file to write to                            [string]
  -y, --yaml     read and write YAML, default JSON                     [boolean]
````

or use the APIs:

````javascript
var converter = require('swagger2openapi');
var options = {};
//options.debug = true; // sets various x-s2o- debugging properties
var openapi = converter.convert(swagger, options);
````

````javascript
var validator = require('swagger2openapi/validate.js');
var options = {};
var result = validator.validate(openapi, options);
````

Or use the [online version](https://openapi-converter.herokuapp.com) which also includes an API

## Vendor extensions

swagger2openapi has support for a limited number of real-world vendor extensions which have a direct bearing on the conversion. All other vendor extensions are left untouched.

Vendor Extension|Vendor|Conversion Performed
|---|---|---|
x-ms-paths|[Microsoft](https://github.com/Azure/autorest/tree/master/docs/extensions)|Treated as an analogue of the `openapi.paths` object
x-ms-skip-url-encoding|[Microsoft](https://github.com/Azure/autorest/tree/master/docs/extensions)|For query parameters, converted to `allowReserved:true`
x-ms-odata|[Microsoft](https://github.com/Azure/autorest/tree/master/docs/extensions)|References to `#/definitions/` are updated to `#/components/schemas`
x-ms-parameterized-host|[Microsoft](https://github.com/Azure/autorest/tree/master/docs/extensions)|**TODO** Not seen in the wild
x-anyOf|[Open Nitro Project](https://github.com/mermade/bbcparse)|Within schemas, converted to `anyOf`
x-oneOf|[Open Nitro Project](https://github.com/mermade/bbcparse)|Within schemas, converted to `oneOf`
x-not|[Open Nitro Project](https://github.com/mermade/bbcparse)|Within schemas, converted to `not`

See also [Amazon API Gateway vendor extensions](http://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-swagger-extensions.html)

It is expected to be able to configure the process of vendor-extension modification using options or a plugin 
mechanism in a future release.

## Tests

To run a test-suite:

````shell
node testRunner {path-to-APIs|single-file}
````

The test harness currently expects files with a `.json` or `.yaml` extension, or a single named file, and has been tested on Node.js versions 4.x and 6.x against

* [APIs.guru](https://github.com/APIs-guru/openapi-directory)
* [Mermade OpenApi specifications collection](https://github.com/mermade/openapi_specifications)
* [SOM-Research collection](https://github.com/SOM-Research/hapi) (overlaps with APIs.guru)

It can also be used as a simple validator if given an existing OpenAPI 3.x definition

## Metadata reporting

Also included is a tool `reportExtensions` to gather a list of vendor (specification) extensions and formats used in a definition or corpus of definitions. For examples of output, see the [wiki](https://github.com/mermade/swagger2openapi/wiki)
