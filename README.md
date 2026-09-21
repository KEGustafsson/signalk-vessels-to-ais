# signalk-vessels-to-ais
[![npm version](https://badge.fury.io/js/signalk-vessels-to-ais.svg)](https://badge.fury.io/js/signalk-vessels-to-ais)
[![Known Vulnerabilities](https://snyk.io/test/github/KEGustafsson/signalk-vessels-to-ais/badge.svg)](https://snyk.io/test/github/KEGustafsson/signalk-vessels-to-ais)

SignalK server plugin to convert other vessel data to NMEA0183 AIS format and forward it out to 3rd party applications.

## Configuration

| Option | Default | Description |
| --- | --- | --- |
| How often AIS data is sent to NMEA0183 out (in minutes) | `1` | Interval between output cycles. E.g. `0.5` = 30 s, `1` = 1 min. This value is also used as the maximum age of a vessel's data: targets older than the interval are not sent. |
| Send own AIS data (VDO) | `true` | Also emit your own vessel as an `!AIVDO` sentence. Requires `sensors.ais.class` to be present for your vessel. |
| Add Tag-block | `false` | Prefix each sentence with an NMEA tag block carrying a source id and timestamp. |
| AIS target within range [km] | `100` | Only vessels within this distance of your own position are sent. |
| Output event name | `nmea0183out` | The SignalK server event the sentences are emitted on. |
| Exclude AIS sources (comma separated) | _(empty)_ | Vessels whose position comes from one of these SignalK sources are not sent. Use it for receivers that already put AIS on the NMEA0183 output themselves, so targets are not duplicated. See below. |

### Excluding sources

Some AIS receivers (for example MAIANA) already emit NMEA0183 AIS sentences
directly, while other sources (for example aiscast/openwaters.io) only feed the
SignalK data model and need this plugin to reach an NMEA0183 output. Combining
both would send targets the receiver has already put on the wire twice.

List those receivers' sources to leave their targets to them:

```
maiana.AI, some-other.II
```

- Matching is case-insensitive, and matches either the full source or a label on
  a dot boundary: `maiana` excludes `maiana.AI` and `maiana.BS`, but not
  `maianaX.AI`.
- A vessel is skipped if **any** source that has written its position is
  excluded, not only the one that wrote most recently. A target seen by both a
  local receiver and an internet feed is already being broadcast by the
  receiver, so emitting the internet copy would duplicate it and relay the
  staler position.
- A consequence worth knowing: while an excluded receiver can see a target, that
  target is never sent by this plugin, even once the receiver loses it. Handing
  a target back over to another source when the receiver goes quiet is not
  implemented.

Leave the field empty to send every vessel, which is the previous behaviour.

New:
- v2.2.0, add: source exclude filter, chore: repository-wide lint clean and enforced in CI, docs: document all configuration options
- v2.1.1, add: App Store screenshot, fix: CI build/format-check scripts, docs: add CHANGELOG.md
- v2.1.0, fix: AIS static data dimensions
- v2.0.0, refactor: use direct data access (app.getPath) instead of REST API, removed node-fetch and moment dependencies, added unit tests
- v1.6.1, fix: ggencoder ^1.0.9 is use
- v1.6.0, fix: enhance error handling for AIS timestamp retrieval
- v1.5.1, fix: fix: improve shipName type checking
- v1.5.0, fix: callSign reading 
- v1.4.0, add: Event output name to user configurable 
- v1.3.0, add: Navigational Status variations
- v1.2.2, fix: if own position is not available
- v1.2.1, fix: own vessel sending
- v1.2.0, updated fetch method, no need for NODE_TLS_REJECT_UNAUTHORIZED=0 anymore
- v1.1.5, updated vessels within selected timeframe are sent out, radius filtering around own vessel and tag-block option added
- v1.1.4, small fix
- v1.1.3, add: own vessel data and sending interval modified
- v1.1.2, fix: http/https url selection and better error info
- v1.1.1, fix: current status of the plugin updated
- v1.1.0, fix: numeric value test for text strings of AIS
- v1.0.0, v1 release
- v0.0.6, fix: node-fetch issue with self signed cert
- v0.0.5, fix: callSign default value
- v0.0.4, fix: beam calc
- v0.0.3, fix: ais path
- v0.0.2, fix: data parsing
- v0.0.1, 1st version
