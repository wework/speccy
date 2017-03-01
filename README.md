# swagger2openapi

![Build](https://img.shields.io/travis/Mermade/swagger2openapi.svg) [![Tested on APIs.guru](https://api.apis.guru/badges/tested_on.svg)](https://APIs.guru) [![Tested on Mermade OpenAPIs](https://mermade.github.io/openapi_optimise/tested.svg)](https://github.com/mermade/openapi_specifications)
[![Known Vulnerabilities](https://snyk.io/test/npm/swagger2openapi/badge.svg)](https://snyk.io/test/npm/swagger2openapi)

Convert Swagger 2.0 definitions into OpenApi 3.0.x

Currently tracking [v3.0.0-RC0](https://github.com/OAI/OpenAPI-Specification/blob/3.0.0-rc0/versions/3.0.md)

Usage:

````
Options:
  -h, --help     Show help                                             [boolean]
  -o, --outfile  the output file to write to                            [string]
  -y, --yaml     read and write YAML, default JSON                     [boolean]
````

or use the API:

````
var options = {};
var openapi = converter.convert(swagger, options);
````
