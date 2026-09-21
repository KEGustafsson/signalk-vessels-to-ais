# Changelog

All notable changes to this project are documented in this file.

## [2.2.0]
- add: source exclude filter (#43) -- new `excludeSources` option; vessels whose position comes from a listed SignalK source are not sent, for receivers that already emit NMEA0183 AIS themselves. A vessel is skipped if any source that has written its position is excluded, not only the most recent one
- chore: lint now covers the whole repository (`eslint .`, previously only `index.js` and `lib/`) and is clean; the 946 pre-existing errors in `test/` are fixed
- chore: lint runs as part of `npm test`, so both CI jobs execute it -- previously lint ran nowhere in CI
- chore: add an eslint override for `test/**` (mocha env; `prefer-arrow-callback` off, since mocha resolves test context via `this`)
- chore: remove unused mocks and bindings from the test suite, hoist `require()` calls to module scope
- docs: document all five configuration options in the README (`distance`, `useTag` and `eventName` were undocumented)

## [2.1.1]
- add: App Store screenshot (`signalk.screenshots` in package.json)
- fix: `doc/` was excluded from the published npm package, so the screenshot never reached the App Store CDN
- fix: CI build/format-check steps referenced npm scripts that don't exist in this project, failing every run
- docs: add this CHANGELOG

## [2.1.0]
- fix: AIS static data dimensions

## [2.0.0]
- refactor: use direct data access (`app.getPath`) instead of REST API
- removed `node-fetch` and `moment` dependencies
- added unit tests

## [1.6.1]
- fix: `ggencoder` ^1.0.9 is in use

## [1.6.0]
- fix: enhance error handling for AIS timestamp retrieval

## [1.5.1]
- fix: improve shipName type checking

## [1.5.0]
- fix: callSign reading

## [1.4.0]
- add: Event output name to user configurable

## [1.3.0]
- add: Navigational Status variations

## [1.2.2]
- fix: own position not available

## [1.2.1]
- fix: own vessel sending

## [1.2.0]
- updated fetch method, no need for `NODE_TLS_REJECT_UNAUTHORIZED=0` anymore

## [1.1.5]
- updated vessels within selected timeframe are sent out
- radius filtering around own vessel added
- tag-block option added

## [1.1.4]
- small fix

## [1.1.3]
- add: own vessel data
- sending interval modified

## [1.1.2]
- fix: http/https url selection and better error info

## [1.1.1]
- fix: current status of the plugin updated

## [1.1.0]
- fix: numeric value test for text strings of AIS

## [1.0.0]
- v1 release

## [0.0.6]
- fix: node-fetch issue with self signed cert

## [0.0.5]
- fix: callSign default value

## [0.0.4]
- fix: beam calc

## [0.0.3]
- fix: AIS path

## [0.0.2]
- fix: data parsing

## [0.0.1]
- 1st version
