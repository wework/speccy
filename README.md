# swagger2openapi

![Build](https://img.shields.io/travis/Mermade/swagger2openapi.svg) [![Tested on APIs.guru](https://api.apis.guru/badges/tested_on.svg)](https://APIs.guru) [![Tested on Mermade OpenAPIs](https://mermade.github.io/openapi_optimise/tested.svg)](https://github.com/mermade/openapi_specifications)
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

or use the API:

````
var options = {};
//options.debug = true; // sets various x-s2o- properties for debugging
var openapi = converter.convert(swagger, options);
````

## Vendor extensions

swagger2openapi has support for a limited number of real-world vendor extensions which have a direct bearing on the conversion. All other vendor extensions are left untouched.

Vendor Extension|Vendor|Conversion Performed
---|---|---
x-ms-paths|Microsoft|Treated as an analogue of the `openapi.paths` object
x-ms-skip-url-encoding|Microsoft|For query parameters, converted to `allowReserved:true`
x-ms-odata|Microsoft|References to `#/definitions/` are updated to `#/components/schemas`
x-anyOf|Open Nitro Project|Within schemas, converted to `anyOf`
x-oneOf|Open Nitro Project|Within schemas, converted to `oneOf`
x-not|Open Nitro Project|Within schemas, converted to `not`

## Tests

To run a test-suite:

````
node testRunner {path-to-APIs|single-file}
````

The test harness currently expects files named `swagger.yaml`, `swagger.json`, `openapi.yaml` or `openapi.json` or a single named file, and has been tested against

* [APIs.guru](https://github.com/APIs-guru/openapi-directory)
* [Mermade OpenApi specifications collection](https://github.com/mermade/openapi_specifications)

It can also be used as a simple validator if given an existing OpenAPI 3.x definition

## Metadata reporting

Also included is a tool `reportExtensions` to gather a list of vendor (specification) extensions and formats used in a definition or corpus of definitions. For examples of output, see the [wiki](https://github.com/mermade/swagger2openapi/wiki)
