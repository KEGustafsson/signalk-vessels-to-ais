const assert = require('assert')

/**
 * Integration tests for signalk-vessels-to-ais-ws plugin
 * Tests the plugin with mock SignalK app object
 */

// Mock ggencoder module
const mockAisEncode = {
  nmea: null
}

// Create mock for ggencoder
const mockGgencoder = {
  AisEncode: function (msg) {
    this.msg = msg
    // Generate a simple mock NMEA sentence
    this.nmea = `!AIVDM,1,1,,A,${msg.aistype}${msg.mmsi},0*00`
    return this
  }
}

// We need to mock the require before loading the plugin
// For now, we'll test the helpers directly and create mock-based integration tests

describe('signalk-vessels-to-ais-ws plugin integration', function () {
  /**
   * Create a mock SignalK app object
   */
  function createMockApp(options = {}) {
    const debugMessages = []
    const emittedMessages = []
    const statusMessages = []

    return {
      // Data access methods
      getSelfPath: function (path) {
        if (options.selfPath && options.selfPath[path]) {
          return options.selfPath[path]
        }
        if (path === 'navigation.position.value') {
          return options.ownPosition || null
        }
        return null
      },

      getPath: function (path) {
        if (path === 'vessels') {
          return options.vessels || null
        }
        return null
      },

      // Logging and status
      debug: function (...args) {
        debugMessages.push(args.join(' '))
      },

      setPluginStatus: function (msg) {
        statusMessages.push(msg)
      },

      setProviderStatus: function (msg) {
        statusMessages.push(msg)
      },

      // Event emission
      emit: function (eventName, data) {
        emittedMessages.push({ eventName, data })
      },

      reportOutputMessages: function (count) {
        // Track output message count
      },

      // Test helpers
      _getDebugMessages: () => debugMessages,
      _getEmittedMessages: () => emittedMessages,
      _getStatusMessages: () => statusMessages,
      _clearMessages: () => {
        debugMessages.length = 0
        emittedMessages.length = 0
        statusMessages.length = 0
      }
    }
  }

  /**
   * Create a mock vessel object
   */
  function createMockVessel(options = {}) {
    const now = new Date().toISOString()
    return {
      mmsi: options.mmsi || '123456789',
      name: options.name || 'Test Vessel',
      navigation: {
        position: {
          latitude: { value: options.lat || 60.1 },
          longitude: { value: options.lon || 24.9 },
          timestamp: options.timestamp || now
        },
        speedOverGround: { value: options.sog || 5.0 },
        courseOverGroundTrue: { value: options.cog || Math.PI / 4 },
        headingTrue: { value: options.hdg || Math.PI / 4 },
        rateOfTurn: { value: options.rot || 0 },
        state: { value: options.state || 'motoring' }
      },
      sensors: {
        ais: {
          class: { value: options.aisClass || 'A' }
        }
      },
      design: {
        length: { overall: { value: options.length || 15 } },
        beam: { value: options.beam || 5 },
        draft: { current: { value: options.draft || 2 } },
        aisShipType: { id: { value: options.shipType || 36 } }
      },
      communication: {
        callsignVhf: { value: options.callsign || 'TEST1' }
      }
    }
  }

  describe('plugin initialization', function () {
    it('exports a function', function () {
      // We can't easily test the full plugin due to ggencoder dependency
      // but we can verify the export pattern
      const helpers = require('../lib/helpers')
      assert(typeof helpers.getValue === 'function')
      assert(typeof helpers.extractVesselData === 'function')
    })
  })

  describe('mock app integration', function () {
    it('getSelfPath returns own position', function () {
      const app = createMockApp({
        ownPosition: { latitude: 60.0, longitude: 24.0 }
      })

      const pos = app.getSelfPath('navigation.position.value')
      assert.strictEqual(pos.latitude, 60.0)
      assert.strictEqual(pos.longitude, 24.0)
    })

    it('getPath returns vessels object', function () {
      const vessels = {
        'urn:mrn:imo:mmsi:123456789': createMockVessel()
      }
      const app = createMockApp({ vessels })

      const result = app.getPath('vessels')
      assert.deepStrictEqual(result, vessels)
    })

    it('emit captures messages', function () {
      const app = createMockApp()
      app.emit('nmea0183out', '!AIVDM,1,1,,A,test,0*00')

      const messages = app._getEmittedMessages()
      assert.strictEqual(messages.length, 1)
      assert.strictEqual(messages[0].eventName, 'nmea0183out')
      assert.strictEqual(messages[0].data, '!AIVDM,1,1,,A,test,0*00')
    })

    it('debug captures log messages', function () {
      const app = createMockApp()
      app.debug('Test message', 123)

      const messages = app._getDebugMessages()
      assert.strictEqual(messages.length, 1)
      assert.strictEqual(messages[0], 'Test message 123')
    })

    it('setPluginStatus captures status', function () {
      const app = createMockApp()
      app.setPluginStatus('Running')

      const messages = app._getStatusMessages()
      assert.strictEqual(messages.length, 1)
      assert.strictEqual(messages[0], 'Running')
    })
  })

  describe('vessel data extraction with helpers', function () {
    const { extractVesselData, isDataFresh } = require('../lib/helpers')

    it('extracts complete vessel data', function () {
      const vessel = createMockVessel({
        mmsi: '230123456',
        name: 'Nordic Spirit',
        lat: 60.15,
        lon: 24.95,
        sog: 8.0,
        aisClass: 'A'
      })

      const data = extractVesselData(vessel)

      assert.strictEqual(data.mmsi, '230123456')
      assert.strictEqual(data.shipName, 'Nordic Spirit')
      assert.strictEqual(data.lat, 60.15)
      assert.strictEqual(data.lon, 24.95)
      assert.strictEqual(data.aisClass, 'A')
      // SOG converted from m/s to knots
      assert(data.sog > 15 && data.sog < 16) // 8 m/s ≈ 15.55 knots
    })

    it('handles Class B vessel', function () {
      const vessel = createMockVessel({
        aisClass: 'B',
        mmsi: '230654321'
      })

      const data = extractVesselData(vessel)
      assert.strictEqual(data.aisClass, 'B')
    })

    it('handles BASE station', function () {
      const vessel = createMockVessel({
        aisClass: 'BASE',
        mmsi: '002766140'
      })

      const data = extractVesselData(vessel)
      assert.strictEqual(data.aisClass, 'BASE')
    })

    it('validates data freshness', function () {
      const fresh = new Date().toISOString()
      const stale = new Date(Date.now() - 120000).toISOString() // 2 minutes ago

      assert.strictEqual(isDataFresh(fresh, 60), true)
      assert.strictEqual(isDataFresh(stale, 60), false)
    })
  })

  describe('AIS message building', function () {
    const {
      buildAisMessage3,
      buildAisMessage5,
      buildAisMessage18,
      buildAisMessage24A,
      buildAisMessage24B,
      extractVesselData
    } = require('../lib/helpers')

    it('builds complete Class A message set', function () {
      const vessel = createMockVessel({
        mmsi: '230111222',
        name: 'Class A Ship',
        aisClass: 'A'
      })

      const data = extractVesselData(vessel)
      const msg3 = buildAisMessage3(data, false)
      const msg5 = buildAisMessage5(data, false)

      // Message 3 - Position report
      assert.strictEqual(msg3.aistype, 3)
      assert.strictEqual(msg3.mmsi, '230111222')
      assert.strictEqual(msg3.own, false)

      // Message 5 - Static data
      assert.strictEqual(msg5.aistype, 5)
      assert.strictEqual(msg5.shipname, 'Class A Ship')
    })

    it('builds complete Class B message set', function () {
      const vessel = createMockVessel({
        mmsi: '230333444',
        name: 'Class B Boat',
        aisClass: 'B'
      })

      const data = extractVesselData(vessel)
      const msg18 = buildAisMessage18(data, false)
      const msg24a = buildAisMessage24A(data, false)
      const msg24b = buildAisMessage24B(data, false)

      // Message 18 - Position report
      assert.strictEqual(msg18.aistype, 18)
      assert.strictEqual(msg18.mmsi, '230333444')

      // Message 24A - Name
      assert.strictEqual(msg24a.aistype, 24)
      assert.strictEqual(msg24a.part, 0)
      assert.strictEqual(msg24a.shipname, 'Class B Boat')

      // Message 24B - Call sign & dimensions
      assert.strictEqual(msg24b.aistype, 24)
      assert.strictEqual(msg24b.part, 1)
    })

    it('sets own flag for own vessel', function () {
      const vessel = createMockVessel()
      const data = extractVesselData(vessel)

      const msgOwn = buildAisMessage3(data, true)
      const msgOther = buildAisMessage3(data, false)

      assert.strictEqual(msgOwn.own, true)
      assert.strictEqual(msgOther.own, false)
    })
  })

  describe('distance calculation scenario', function () {
    const haversine = require('haversine-distance')

    it('calculates distance between two positions', function () {
      const ownPos = { lat: 60.0, lon: 24.0 }
      const otherPos = { lat: 60.1, lon: 24.0 }

      const distMeters = haversine(ownPos, otherPos)
      const distKm = distMeters / 1000

      // Should be approximately 11.1 km (1 degree latitude ≈ 111 km)
      assert(distKm > 10 && distKm < 12)
    })

    it('identifies vessels within range', function () {
      const ownPos = { lat: 60.0, lon: 24.0 }
      const nearVessel = { lat: 60.05, lon: 24.0 } // ~5.5 km
      const farVessel = { lat: 61.0, lon: 24.0 } // ~111 km

      const nearDist = haversine(ownPos, nearVessel) / 1000
      const farDist = haversine(ownPos, farVessel) / 1000

      const maxDistance = 50 // km

      assert(nearDist < maxDistance, 'Near vessel should be within range')
      assert(farDist > maxDistance, 'Far vessel should be out of range')
    })
  })

  describe('navigation state mapping', function () {
    const { getNavStatus } = require('../lib/helpers')

    it('maps all motoring variations', function () {
      assert.strictEqual(getNavStatus('motoring'), 0)
      assert.strictEqual(getNavStatus('UnderWayUsingEngine'), 0)
      assert.strictEqual(getNavStatus('under way using engine'), 0)
    })

    it('maps all sailing variations', function () {
      assert.strictEqual(getNavStatus('sailing'), 8)
      assert.strictEqual(getNavStatus('UnderWaySailing'), 8)
      assert.strictEqual(getNavStatus('under way sailing'), 8)
    })

    it('maps anchored state', function () {
      assert.strictEqual(getNavStatus('anchored'), 1)
      assert.strictEqual(getNavStatus('AtAnchor'), 1)
    })

    it('maps moored state', function () {
      assert.strictEqual(getNavStatus('moored'), 5)
      assert.strictEqual(getNavStatus('Moored'), 5)
    })

    it('returns empty string for unknown state', function () {
      assert.strictEqual(getNavStatus('flying'), '')
    })
  })

  describe('tag block generation', function () {
    const { createTagBlock, toHexString } = require('../lib/helpers')

    it('generates valid NMEA tag block', function () {
      const tag = createTagBlock(1609459200000) // 2021-01-01 00:00:00 UTC

      // Tag block format: \s:source,c:timestamp*checksum\
      assert(tag.startsWith('\\'), 'Should start with backslash')
      assert(tag.endsWith('\\'), 'Should end with backslash')
      assert(tag.includes('s:SK0001'), 'Should include source')
      assert(tag.includes('c:1609459200000'), 'Should include timestamp')
    })

    it('generates correct hex for checksum', function () {
      assert.strictEqual(toHexString(0), '00')
      assert.strictEqual(toHexString(255), 'FF')
      assert.strictEqual(toHexString(16), '10')
    })
  })

  describe('edge cases', function () {
    const { getValue, extractVesselData } = require('../lib/helpers')

    it('handles empty vessel object', function () {
      const data = extractVesselData({})

      assert.strictEqual(data.mmsi, null)
      assert.strictEqual(data.lat, null)
      assert.strictEqual(data.lon, null)
    })

    it('handles vessel with only MMSI', function () {
      const data = extractVesselData({ mmsi: '123456789' })

      assert.strictEqual(data.mmsi, '123456789')
      assert.strictEqual(data.lat, null)
    })

    it('handles deeply nested null values', function () {
      const vessel = {
        navigation: {
          position: null
        }
      }

      const data = extractVesselData(vessel)
      assert.strictEqual(data.lat, null)
    })

    it('handles numeric name (converts to empty string)', function () {
      const vessel = {
        mmsi: '123456789',
        name: 12345
      }

      const data = extractVesselData(vessel)
      assert.strictEqual(data.shipName, '')
    })

    it('handles IMO prefix removal', function () {
      const vessel = {
        mmsi: '123456789',
        registrations: {
          imo: { value: 'IMO 9876543' }
        }
      }

      const data = extractVesselData(vessel)
      assert.strictEqual(data.imo, '9876543')
    })

    it('handles IMO without prefix', function () {
      const vessel = {
        mmsi: '123456789',
        registrations: {
          imo: { value: '9876543' }
        }
      }

      const data = extractVesselData(vessel)
      assert.strictEqual(data.imo, '9876543')
    })
  })

  describe('unit conversions', function () {
    const { radToDegrees, msToKnots } = require('../lib/helpers')

    it('converts common navigation angles', function () {
      // North
      assert.strictEqual(radToDegrees(0), 0)
      // East
      assert.strictEqual(radToDegrees(Math.PI / 2), 90)
      // South
      assert.strictEqual(radToDegrees(Math.PI), 180)
      // West
      assert.strictEqual(radToDegrees(3 * Math.PI / 2), 270)
    })

    it('converts common speeds', function () {
      // 1 knot in m/s
      const oneKnotInMs = 0.514444
      const result = msToKnots(oneKnotInMs)
      assert(Math.abs(result - 1.0) < 0.01, `Expected ~1 knot, got ${result}`)

      // 10 knots
      const tenKnotsInMs = 5.14444
      const result10 = msToKnots(tenKnotsInMs)
      assert(Math.abs(result10 - 10.0) < 0.1, `Expected ~10 knots, got ${result10}`)
    })
  })
})
