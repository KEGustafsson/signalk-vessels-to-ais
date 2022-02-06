# signalk-vessels-to-ais
[![npm version](https://badge.fury.io/js/signalk-vessels-to-ais.svg)](https://badge.fury.io/js/signalk-vessels-to-ais)
[![Known Vulnerabilities](https://snyk.io/test/github/KEGustafsson/signalk-vessels-to-ais/badge.svg)](https://snyk.io/test/github/KEGustafsson/signalk-vessels-to-ais)

SignalK server plugin to convert other vessel data to NMEA0183 AIS format and forward it out to 3rd party applications.

User can configure:
- How often data is sent out
- Own data can be added to AIS sending

New:
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
