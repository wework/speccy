# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- Path Item `$ref` support fixed ([#16])

[#16]: https://github.com/wework/speccy/pull/16

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
