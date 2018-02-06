# speccy

![Build](https://img.shields.io/travis/wework/speccy/master.svg)
[![Coverage Status](https://coveralls.io/repos/github/wework/speccy/badge.svg?branch=master)](https://coveralls.io/github/wework/speccy?branch=master)
[![Known Vulnerabilities](https://snyk.io/test/npm/speccy/badge.svg)](https://snyk.io/test/npm/speccy)

Make sure your OpenAPI 3.0 specifications are more than just valid, make sure they're useful!

Taking off from where [Mike Ralphson] started with linting in [swagger2openapi], Speccy aims to become the [rubocop] or [eslint] of OpenAPI.

## OpenAPI Specification

Currently tracking [v3.0.0](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.0.md)

If you want to run speccy on OpenAPI (f.k.a Swagger) v2.0 specs, run it through [swagger2openapi] first and speccy can give advice on the output.

## Usage

```
Usage: speccy <command>


Options:

  -V, --version  output the version number
  -h, --help     output usage information


Commands:

  lint [options] <file-or-url>  Ensure your OpenAPI files are valid and up to scratch
```

Right now the only command is lint, which looks like this:

```
Usage: lint [options] <file-or-url>

Ensure your OpenAPI files are valid and up to scratch

Options:

    -r, --rules [ruleFile]  use this multiple times to select multiple rules files
    -h, --help              output usage information
```

You'll see output such as:

```
#/info  R: info-contact  D: info object should contain contact object

expected Object {
  version: '5.0',
  title: 'Foo API'
} to have property contact
```

There are going to be different things people are interested in, so the [default rules][rules-default] suggest things we think everyone should do; adding descriptions to parameters and operations, and having some sort of contact info.

There are [strict rules][rules-strict] which demand more contact details, "real" domains, a license, and requires tags have a description!

There are also [wework rules][rules-wework], building things we consider important on top of the strict rules; keeping summaries short (so they fit into ReDoc navigation for example).

## Features

### Rules

Rule actions from the [default rules][rules-default] will be used if no rules file is specified. Right now there are only the three bundled options, but supporting custom rules files via local path and URL is on the roadmap.

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
[rules-default]: https://github.com/wework/speccy/blob/master/rules/default.json
[rules-strict]: https://github.com/wework/speccy/blob/master/rules/strict.json
[rules-wework]: https://github.com/wework/speccy/blob/master/rules/wework.json
[rubocop]: https://github.com/bbatsov/rubocop
[eslint]: https://eslint.org/
