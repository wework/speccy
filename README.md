# speccy

![Build](https://img.shields.io/travis/wework/speccy/master.svg)
[![Coverage Status](https://coveralls.io/repos/github/wework/speccy/badge.svg?branch=master)](https://coveralls.io/github/wework/speccy?branch=master)
[![Known Vulnerabilities](https://snyk.io/test/npm/speccy/badge.svg)](https://snyk.io/test/npm/speccy)

Enforce quality rules on your OpenApi 3.0.x specifications.

Currently tracking [v3.0.0](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.0.md)

```
Usage: speccy <command> [options] <file-or-url>


Options:

  -V, --version  output the version number
  -h, --help     output usage information


Commands:

  lint [options] <file-or-url>  Ensure your OpenAPI files are valid and up to scratch
```

You'll see output such as:

```
#/tags/Foo
expected Object { name: 'Foo' } to have property description
```

This Foo tag needs a description, so people will know what the heck it is!

## Features

### Rules

By default the [base](/rules/base.json) rules are used, but you can create your own rules files to use.

Contributions of rules and rule actions for the linter are very much appreciated.

## Tests

To run the test-suite:

```shell
npm test
```

## License

[BSD-3-Clause](LICENSE) except the `openapi-3.0.json` schema, which is taken from the [OpenAPI-Specification](https://github.com/OAI/OpenAPI-Specification/blob/49e784d7b7800da8732103aa3ac56bc7ccde5cfb/schemas/v3.0/schema.yaml) and the alternative `gnostic-3.0.json` schema, which is originally from [Google Gnostic](https://github.com/googleapis/gnostic/blob/master/OpenAPIv3/openapi-3.0.json). Both of these are licensed under the [Apache-2](http://www.apache.org/licenses/LICENSE-2.0) license.

[swagger2openapi]: https://github.com/Mermade/swagger2openapi/
[Mike Ralphson]: https://twitter.com/PermittedSoc/
