/* eslint-disable no-bitwise */
/*
MIT License

Copyright (c) 2020 Karl-Erik Gustafsson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

/**
 * Modified version using app.getPath() instead of REST API
 * - No HTTP/HTTPS configuration needed
 * - No node-fetch dependency
 * - Direct access to SignalK data model
 */

const AisEncode = require('ggencoder').AisEncode
const haversine = require('haversine-distance')
const {
  getValue,
  getTimestamp,
  createTagBlock,
  extractVesselData,
  buildAisMessage3,
  buildAisMessage5,
  buildAisMessage18,
  buildAisMessage24A,
  buildAisMessage24B,
  isDataFresh
} = require('./lib/helpers')

module.exports = function createPlugin(app) {
  const plugin = {}
  plugin.id = 'signalk-vessels-to-ais-ws'
  plugin.name = 'Other vessels data to AIS NMEA0183 (WebSocket)'
  plugin.description =
    'SignalK server plugin to convert other vessel data to NMEA0183 AIS format using direct data access (no REST API)'

  let intervalId = null
  let positionUpdate = 60
  let distance = 100
  let sendOwn = true
  let useTag = false
  let eventName = 'nmea0183out'

  const setStatus = app.setPluginStatus || app.setProviderStatus

  // NMEA output
  function aisOut(encMsg) {
    const enc = new AisEncode(encMsg)
    const sentence = enc.nmea
    let tagString = ''
    if (useTag) {
      tagString = createTagBlock()
    }
    if (sentence && sentence.length > 0) {
      app.debug(tagString + sentence)
      app.emit(eventName, tagString + sentence)
    }
  }

  /**
   * Main data processing function
   * Uses app.getPath() instead of REST API
   */
  function processVessels() {
    // Get own position for distance calculation
    const ownPosition = app.getSelfPath('navigation.position.value')
    if (!ownPosition || ownPosition.latitude === undefined || ownPosition.longitude === undefined) {
      app.debug('Own position not available, skipping')
      return
    }

    const ownLat = ownPosition.latitude
    const ownLon = ownPosition.longitude

    // Get all vessels using direct data access - NO REST API!
    const vessels = app.getPath('vessels')
    if (!vessels) {
      app.debug('No vessels data available')
      return
    }

    const vesselIds = Object.keys(vessels)
    let processedCount = 0
    let isFirst = true

    for (const vesselId of vesselIds) {
      const vessel = vessels[vesselId]

      // Determine if this is own vessel
      const isOwn = isFirst
      isFirst = false

      // Skip own vessel if not configured to send
      if (isOwn && !sendOwn) {
        continue
      }

      // Extract AIS timestamp for freshness check
      let aisTime = getValue(vessel, 'sensors.ais.class.timestamp')
      if (!aisTime) {
        aisTime = getTimestamp(vessel, 'navigation.position')
      }

      // Check data freshness
      const aisDelay = isDataFresh(aisTime, positionUpdate)

      // Extract vessel data using helper
      const data = extractVesselData(vessel)

      // Skip if no position
      if (data.lat === null || data.lon === null) {
        continue
      }

      // Calculate distance from own vessel
      const a = { lat: ownLat, lon: ownLon }
      const b = { lat: data.lat, lon: data.lon }
      const dist = (haversine(a, b) / 1000).toFixed(2)

      // Check if within distance range
      if (parseFloat(dist) > distance) {
        continue
      }

      // Send AIS messages based on class
      if (aisDelay && (data.aisClass === 'A' || data.aisClass === 'B' || data.aisClass === 'BASE')) {
        app.debug(
          `Distance range: ${distance}km, AIS target distance: ${dist}km, Class ${data.aisClass} Vessel, MMSI:${data.mmsi}`
        )

        if (data.aisClass === 'A') {
          app.debug(`Class A, MMSI: ${data.mmsi}, Name: ${data.shipName || 'Unknown'}`)
          aisOut(buildAisMessage3(data, isOwn))
          aisOut(buildAisMessage5(data, isOwn))
          processedCount++
        }

        if (data.aisClass === 'B') {
          app.debug(`Class B, MMSI: ${data.mmsi}, Name: ${data.shipName || 'Unknown'}`)
          aisOut(buildAisMessage18(data, isOwn))
          aisOut(buildAisMessage24A(data, isOwn))
          aisOut(buildAisMessage24B(data, isOwn))
          processedCount++
        }

        if (data.aisClass === 'BASE') {
          app.debug(`Base Station, MMSI: ${data.mmsi}`)
          aisOut(buildAisMessage3(data, isOwn))
          processedCount++
        }

        app.debug('--------------------------------------------------------')
      }
    }

    const dateObj = new Date(Date.now())
    const date = dateObj.toISOString()
    setStatus(`${processedCount} AIS targets sent: ${date}`)

    if (processedCount > 0) {
      app.reportOutputMessages(processedCount)
    }
  }

  plugin.start = function (options) {
    positionUpdate = (options.position_update || 1) * 60
    distance = options.distance || 100
    sendOwn = options.sendOwn !== false
    useTag = options.useTag || false
    eventName = options.eventName || 'nmea0183out'

    app.debug('Plugin starting with direct data access (no REST API)')
    app.debug(`Update interval: ${positionUpdate}s, Distance: ${distance}km`)

    // Initial run
    processVessels()

    // Set up periodic processing
    intervalId = setInterval(processVessels, positionUpdate * 1000)

    setStatus('Running')
    app.debug('Plugin started')
  }

  plugin.stop = function () {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
    app.debug('Plugin stopped')
  }

  plugin.schema = {
    type: 'object',
    properties: {
      position_update: {
        type: 'number',
        default: 1,
        title: 'How often AIS data is sent to NMEA0183 out (in minutes)',
        description: 'E.g. 0.5 = 30s, 1 = 1min'
      },
      sendOwn: {
        type: 'boolean',
        title: 'Send own AIS data (VDO)',
        default: true
      },
      useTag: {
        type: 'boolean',
        title: 'Add Tag-block',
        default: false
      },
      distance: {
        type: 'integer',
        default: 100,
        title: 'AIS target within range [km]'
      },
      eventName: {
        type: 'string',
        default: 'nmea0183out',
        title: 'Output event name'
      }
    }
  }

  return plugin
}
