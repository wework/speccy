# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
