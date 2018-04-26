# speccy

[![CircleCI](https://circleci.com/gh/wework/speccy.svg?style=svg)](https://circleci.com/gh/wework/speccy)
[![Coverage Status](https://coveralls.io/repos/github/wework/speccy/badge.svg)](https://coveralls.io/github/wework/speccy)
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

  lint [options] <file-or-url>     ensure specs are not just valid OpenAPI, but lint against specified rules
  resolve [options] <file-or-url>  pull in external $ref files to create one mega-file
  serve [options] <file-or-url>    view specifications in beautiful human readable documentation
```

### Lint Command

The goal here is to sniff your files for potentially bad things. "Bad" is objective, but you'll see validation errors, along with special rules for making your APIs better..

```
Usage: lint [options] <file-or-url>

ensure specs are not just valid OpenAPI, but lint against specified rules

Options:

  -q, --quiet             reduce verbosity
  -r, --rules [ruleFile]  provide multiple rules files
  -s, --skip [ruleName]   provide multiple rules to skip
  -j, --json-schema       treat $ref like JSON Schema and convert to OpenAPI Schema Objects
  -v, --verbose           increase verbosity
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

#### Rules

Rule actions from the [default rules][rules-default] will be used if no rules file is specified. Right now there are only the three bundled options, but supporting custom rules files via local path and URL is on the roadmap.

Contributions of rules and rule actions for the linter are very much appreciated.

### Serve Command

Using [ReDoc], speccy can offer a preview of your specifications, in human-readable format.
In the future we'll have speccy outlining improvements right in here, but one thing at a time.

```
Usage: serve [options] <file-or-url>

view specifications in beautiful human readable documentation

Options:

  -p, --port [value]  port on which the server will listen (default: 5000)
  -q, --quiet         reduce verbosity
  -j, --json-schema   treat $ref like JSON Schema and convert to OpenAPI Schema Objects
  -v, --verbose       increase verbosity
  -h, --help          output usage information
```

Like everything in speccy, this only works for OpenAPI v3.


## Tests

To run the test-suite:

```shell
npm test
```

## Credits

- [Mike Ralphson] for providing the initial linter/validator from [swagger2openapi]
- [Roman Gotsiy] for the excellent [ReDoc]
- [Kenta Mori] for providing the serve logic from [redocup]
- [All Contributors][link-contributors]

## License

[BSD-3-Clause](LICENSE) except the `openapi-3.0.json` schema, which is taken from the [OpenAPI-Specification](https://github.com/OAI/OpenAPI-Specification/blob/49e784d7b7800da8732103aa3ac56bc7ccde5cfb/schemas/v3.0/schema.yaml) and the alternative `gnostic-3.0.json` schema, which is originally from [Google Gnostic](https://github.com/googleapis/gnostic/blob/master/OpenAPIv3/openapi-3.0.json). Both of these are licensed under the [Apache-2](http://www.apache.org/licenses/LICENSE-2.0) license.

[Kenta Mori]: https://github.com/zoncoen/
[Mike Ralphson]: https://twitter.com/PermittedSoc/
[ReDoc]: https://github.com/Rebilly/ReDoc
[Roman Gotsiy]: https://github.com/RomanGotsiy
[eslint]: https://eslint.org/
[link-contributors]: https://github.com/wework/speccy/graphs/contributors
[redocup]: https://github.com/zoncoen/redocup/
[rubocop]: https://github.com/bbatsov/rubocop
[rules-default]: https://github.com/wework/speccy/blob/master/rules/default.json
[rules-strict]: https://github.com/wework/speccy/blob/master/rules/strict.json
[rules-wework]: https://github.com/wework/speccy/blob/master/rules/wework.json
[swagger2openapi]: https://github.com/Mermade/swagger2openapi/
