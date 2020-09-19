# signalk-vessels-to-ais
[![npm version](https://badge.fury.io/js/signalk-vessels-to-ais.svg)](https://badge.fury.io/js/signalk-vessels-to-ais)
[![Known Vulnerabilities](https://snyk.io/test/github/KEGustafsson/signalk-vessels-to-ais/badge.svg)](https://snyk.io/test/github/KEGustafsson/signalk-vessels-to-ais)

SignalK server plugin to convert other vessel data to NMEA0183 AIS format and forward it out to 3rd party applications.

User can configure:
- How often data is sent out

New:
- v1.1.0, fix:cnumeric value test for text strings of AIS
- v1.0.0, v1 release
- v0.0.6, fix:node-fetch issue with self signed cert
- v0.0.5, fix:callSign default value
- v0.0.4, fix:beam calc
- v0.0.3, fix:ais path
- v0.0.2, fix:data parsing
- v0.0.1, 1st version
