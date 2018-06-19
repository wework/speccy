---
# Feel free to add content and custom Front Matter to this file.
# To modify the layout, see https://jekyllrb.com/docs/themes/#overriding-theme-defaults

layout: home
title: Home
---

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

The goal here is to sniff your files for potentially bad things. "Bad" is subjective, but you'll see validation errors, along with special rules for making your APIs better..

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


### Resolve Command

Resolving `$ref` is the art of taking multiple files and squashing them all down into one big OpenAPI file. By default it will output to stdout, but you can pass `-o` with a file name to write the file locally.

```
Usage: resolve [options] <file-or-url>

pull in external $ref files to create one mega-file

Options:

  -o, --output <file>  file to output to
  -q, --quiet          reduce verbosity
  -j, --json-schema    treat $ref like JSON Schema and convert to OpenAPI Schema Objects
  -v, --verbose        increase verbosity
  -h, --help           output usage information
```

Starting with the fantastic resolver logic form swagger2openapi, speccy has one of the most robust
resolvers out there. It avoid cyclical dependencies (when A has a property that `$ref`s A, which in turn destroys your CPU), and all sorts of other things.

Thanks to the `--json-schema` switch, you can have an OpenAPI file which `$ref`s JSON Schema files (not just OpenAPI-flavoured JSON Schema), then resolve them all into one real OpenAPI file, thanks to [wework/json-schema-to-openapi-schema].

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

### Calling Speccy from Code

Not just a command line tool, speccy can be used to normalize machine-readable specifications.


The loader object will return a promise that resolves to an object containing
the specification.  For example:

``` javascript
const loader = require('speccy/lib/loader');

const options = {
  resolve: true,   // Resolve external references
  jsonSchema: true // Treat $ref like JSON Schema and convert to OpenAPI Schema Objects
};

loader
  .loadSpec('path/to/my/spec', options)            // Load the spec...
  .then(spec => console.log(JSON.stringify(spec)); // ...and print it out.
```

If `options.resolve` is truthy, speccy will resolve _external_ references.

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
