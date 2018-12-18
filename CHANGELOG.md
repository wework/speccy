# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- `notContain` rulesets can now support pattern matching. ([#208] via [@erunion])
### Fixed
- Support options after the command name, and at the end of the command ([#229])

[@erunion]: https://github.com/erunion
[#208]: https://github.com/wework/speccy/issues/208
[#229]: https://github.com/wework/speccy/pull/229

## [0.8.5] - 2018-11-15
### Added
- Custom rulesets can now be loaded from the local filesystem, thanks [@erunion]! ([#196])
### Fixed
- More resolving errors fixed upgrading oas-kit ([#185] & [#187])

[@erunion]: https://github.com/erunion
[#185]: https://github.com/wework/speccy/issues/185
[#187]: https://github.com/wework/speccy/issues/187
[#196]: https://github.com/wework/speccy/pull/196

## [0.8.4] - 2018-10-16
### Fixed
- Referenced files containing spaces would fail to load on OS X and Linux ([#181])

[#181]: https://github.com/wework/speccy/pull/181

## [0.8.3] - 2018-10-16
### Fixed
- Callbacks and Security Requirements were failing due to bug in dependency ([#180])

[#180]: https://github.com/wework/speccy/pull/180


## [0.8.2] - 2018-09-17
### Added
- New rule for when the default rules match the example rules provided
### Fixed
- `--skip` and `--rules` were being ignored in v0.8.0 - v0.8.1
- Stopped `GET filename.yaml` showing up in normal output (should only show in verbose mode)

## [0.8.1] - 2018-08-22
### Fixed
- Rules using action `notEndWith` (like `path-keys-no-trailing-slash`) should not cause validation errors when string length is 1 ([#137])

[#137]: https://github.com/wework/speccy/pull/137

## [0.8.0] - 2018-08-09
### Changed
- Switched to using [oas-kit] for resolving and validating
- Moved `short-summary` from `wework` to `strict` rules ([#110])
- YAML files were previously loaded in "JSON mode", which meant duplicate keys were allowed. They will now error ([#108])
### Added
- Config files can be passed with `-c` (defaults to `speccy.yaml`). See [README](./README.md) for more information
- Enabled `path-keys-no-trailing-slash` now oas-resolver can handle keys for lint rules
- Enabled [better-ajv-errors][] for beautiful validation errors. Linter errors remain unchanged
### Fixed
- Resolving to a file would silently fail when writing to a folder that did not exist
### Removed
- Got rid of `wework` rules, as the last rule was moved to `strict` ([#110])

[#90]: https://github.com/wework/speccy/pull/90
[#108]: https://github.com/wework/speccy/pull/108
[#110]: https://github.com/wework/speccy/pull/110
[better-ajv-errors]: https://github.com/atlassian/better-ajv-errors
[oas-kit]: https://github.com/Mermade/oas-kit

## [0.7.3] - 2018-06-19
### Added
- Provide "More Info" links in linter errors, so users understand the reasoning behind various rules. ([#90])

[#90]: https://github.com/wework/speccy/pull/90

## [0.7.2] - 2018-05-31
### Fixed
- Fix `message is undefined` error ([#78])
- Resolver was treating `$ref` with a URL like a file. ([#80])

[#78]: https://github.com/wework/speccy/pull/78
[#80]: https://github.com/wework/speccy/pull/80

## [0.7.1] - 2018-05-17
### Fixed
- Using `not` without `oneOf` since 0.7.0 was causing validation failures

## [0.7.0] - 2018-05-10
### Breaking Change
- Error now raised for all commands when `$ref` points to a file that does not exist, or cannot be opened
### Fixed
- Bumped `json-schema-to-openapi-schema` to v0.2.0 so subschemas will be converted
- Invalid keywords will be stripped everywhere instead of just root

## [0.6.0] - 2018-05-04
## Removed
- Removed switch `--watch` as it didn't actually work, and was flagging "security issues" on npm ([#46])
## Added
- Support URLs in `--rules` for lint command ([#41])
- New switch `--json-schema / -j` will tell speccy to resolve $refs as JSON Schema, converting them to OpenAPI on the fly ([#45])

[#41]: https://github.com/wework/speccy/pull/41
[#45]: https://github.com/wework/speccy/pull/45
[#46]: https://github.com/wework/speccy/pull/46


## [0.5.4] - 2018-04-04
### Changed
- `properties` rule will now ignore extensions, so `foo: 'a', x-bar: 'b'` is only 1 property.
### Fixed
- Disabled `reference-components-regex` rule until resolver can allow it to work

## [0.5.3] - 2018-03-29
### Fixed
- Warn about YAML/JSON parsing errors in referenced files ([#36])
- Fixed max length (it was previously enforcing exact length) ([#38])

[#36]: https://github.com/wework/speccy/pull/36
[#38]: https://github.com/wework/speccy/pull/38

## [0.5.2] - 2018-03-27
### Added
- Loads of tests
### Fixed
- Allow `$refs` to link Objects ([#22])
- Fixes "Unhandled promise rejection" messages for not found files ([#27])
- Can now use `--verbose` for lint and serve ([#29])

[#22]: https://github.com/wework/speccy/pull/22
[#27]: https://github.com/wework/speccy/pull/27
[#29]: https://github.com/wework/speccy/pull/29

## [0.5.1] - 2018-03-27
- Learning how to npm publish

## [0.5.0] - 2018-03-09
### Breaking Changes
- Dropped support for NodeJS 6, now requires 7.5 (with `--harmony`) or higher.
### Fixed
- Linter was not resolving $ref properly, meaning more errors will now appear in $ref schemas ([#19])
### Added
- Serve command now supports URLs ([#19])

[#19]: https://github.com/wework/speccy/pull/19

## [0.4.1] - 2018-03-07
### Fixed
- Path Item `$ref` support fixed in validator ([#16])
- Serve command early exists and errors if file is not found, even added some tests ([#17])

[#16]: https://github.com/wework/speccy/pull/16
[#17]: https://github.com/wework/speccy/pull/17

## [0.4.0] - 2018-02-26
### Added
- Added `--skip` to lint command to allow certain rules to be skipped ([#9] via @jblazek)
- CLI output shows all lint errors, not just the first error found ([#11] via @jblazek)

[#9]: https://github.com/wework/speccy/pull/9
[#11]: https://github.com/wework/speccy/pull/11

## [0.3.1] - 2018-02-15
### Added
- Fixed `serve` command when package is installed via yarn global

## [0.3.0] - 2018-02-15
### Added
- New `serve` command, to serve up ReDoc documentation without needing a local html file and your own server
- Added `openapi-tags-alphabetical` rule to snark if your tags definitions are out of order

## [0.2.2] - 2018-02-08
### Fixed
- Object spread was causing errors on node 6 and 7.
