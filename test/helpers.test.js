const assert = require('assert')
const {
  stateMapping,
  getValue,
  getTimestamp,
  radToDegrees,
  msToKnots,
  toHexString,
  createTagBlock,
  getNavStatus,
  extractVesselData,
  buildAisMessage3,
  buildAisMessage5,
  buildAisMessage18,
  buildAisMessage24A,
  buildAisMessage24B,
  isDataFresh
} = require('../lib/helpers')

describe('signalk-vessels-to-ais-ws helpers', function () {
  // ============================================================
  // getValue tests
  // ============================================================
  describe('getValue', function () {
    it('returns null for null input', function () {
      assert.strictEqual(getValue(null, 'any.path'), null)
    })

    it('returns null for undefined input', function () {
      assert.strictEqual(getValue(undefined, 'any.path'), null)
    })

    it('returns direct value for simple path', function () {
      const obj = { mmsi: '123456789' }
      assert.strictEqual(getValue(obj, 'mmsi'), '123456789')
    })

    it('returns nested value for dotted path', function () {
      const obj = {
        navigation: {
          position: {
            latitude: 60.1
          }
        }
      }
      assert.strictEqual(getValue(obj, 'navigation.position.latitude'), 60.1)
    })

    it('extracts value from SignalK value wrapper', function () {
      const obj = {
        navigation: {
          speedOverGround: {
            value: 5.5,
            timestamp: '2024-01-01T00:00:00Z'
          }
        }
      }
      assert.strictEqual(getValue(obj, 'navigation.speedOverGround'), 5.5)
    })

    it('returns null for non-existent path', function () {
      const obj = { navigation: {} }
      assert.strictEqual(getValue(obj, 'navigation.position.latitude'), null)
    })

    it('handles path with missing intermediate object', function () {
      const obj = { navigation: null }
      assert.strictEqual(getValue(obj, 'navigation.position.latitude'), null)
    })

    it('returns object if value property not present', function () {
      const obj = {
        design: {
          length: {
            overall: 15.5
          }
        }
      }
      assert.deepStrictEqual(getValue(obj, 'design.length'), { overall: 15.5 })
    })
  })

  // ============================================================
  // getTimestamp tests
  // ============================================================
  describe('getTimestamp', function () {
    it('returns null for null input', function () {
      assert.strictEqual(getTimestamp(null, 'any.path'), null)
    })

    it('returns null for undefined input', function () {
      assert.strictEqual(getTimestamp(undefined, 'any.path'), null)
    })

    it('extracts timestamp from SignalK object', function () {
      const timestamp = '2024-01-01T12:00:00Z'
      const obj = {
        navigation: {
          position: {
            value: { latitude: 60.1, longitude: 24.9 },
            timestamp: timestamp
          }
        }
      }
      assert.strictEqual(getTimestamp(obj, 'navigation.position'), timestamp)
    })

    it('returns null if no timestamp property', function () {
      const obj = {
        navigation: {
          position: {
            value: { latitude: 60.1, longitude: 24.9 }
          }
        }
      }
      assert.strictEqual(getTimestamp(obj, 'navigation.position'), null)
    })

    it('returns null for non-existent path', function () {
      const obj = { navigation: {} }
      assert.strictEqual(getTimestamp(obj, 'navigation.position'), null)
    })
  })

  // ============================================================
  // radToDegrees tests
  // ============================================================
  describe('radToDegrees', function () {
    it('returns null for null input', function () {
      assert.strictEqual(radToDegrees(null), null)
    })

    it('returns null for undefined input', function () {
      assert.strictEqual(radToDegrees(undefined), null)
    })

    it('converts 0 radians to 0 degrees', function () {
      assert.strictEqual(radToDegrees(0), 0)
    })

    it('converts PI radians to 180 degrees', function () {
      assert.strictEqual(radToDegrees(Math.PI), 180)
    })

    it('converts PI/2 radians to 90 degrees', function () {
      assert.strictEqual(radToDegrees(Math.PI / 2), 90)
    })

    it('converts 2*PI radians to 360 degrees', function () {
      assert.strictEqual(radToDegrees(2 * Math.PI), 360)
    })

    it('converts negative radians correctly', function () {
      assert.strictEqual(radToDegrees(-Math.PI), -180)
    })

    it('handles fractional radians', function () {
      const result = radToDegrees(1)
      assert(Math.abs(result - 57.29577951308232) < 0.0001)
    })
  })

  // ============================================================
  // msToKnots tests
  // ============================================================
  describe('msToKnots', function () {
    it('returns null for null input', function () {
      assert.strictEqual(msToKnots(null), null)
    })

    it('returns null for undefined input', function () {
      assert.strictEqual(msToKnots(undefined), null)
    })

    it('converts 0 m/s to 0 knots', function () {
      assert.strictEqual(msToKnots(0), 0)
    })

    it('converts 1 m/s to approximately 1.94 knots', function () {
      const result = msToKnots(1)
      assert(Math.abs(result - 1.9438) < 0.001)
    })

    it('converts 10 m/s to approximately 19.44 knots', function () {
      const result = msToKnots(10)
      assert(Math.abs(result - 19.438) < 0.01)
    })

    it('converts 0.5144 m/s (1 knot) back to approximately 1 knot', function () {
      const result = msToKnots(0.5144)
      assert(Math.abs(result - 1.0) < 0.01)
    })
  })

  // ============================================================
  // toHexString tests
  // ============================================================
  describe('toHexString', function () {
    it('converts 0 to 00', function () {
      assert.strictEqual(toHexString(0), '00')
    })

    it('converts 15 to 0F', function () {
      assert.strictEqual(toHexString(15), '0F')
    })

    it('converts 16 to 10', function () {
      assert.strictEqual(toHexString(16), '10')
    })

    it('converts 255 to FF', function () {
      assert.strictEqual(toHexString(255), 'FF')
    })

    it('converts 170 to AA', function () {
      assert.strictEqual(toHexString(170), 'AA')
    })

    it('converts 100 to 64', function () {
      assert.strictEqual(toHexString(100), '64')
    })
  })

  // ============================================================
  // createTagBlock tests
  // ============================================================
  describe('createTagBlock', function () {
    it('creates valid tag block format', function () {
      const tag = createTagBlock(1234567890123)
      assert(tag.startsWith('\\'))
      assert(tag.endsWith('\\'))
      assert(tag.includes('s:SK0001'))
      assert(tag.includes('c:1234567890123'))
      assert(tag.includes('*'))
    })

    it('includes checksum in hex format', function () {
      const tag = createTagBlock(1234567890123)
      const match = tag.match(/\*([0-9A-F]{2})\\$/)
      assert(match !== null, 'Tag block should end with *XX\\ format')
    })

    it('generates consistent checksum for same input', function () {
      const tag1 = createTagBlock(1234567890123)
      const tag2 = createTagBlock(1234567890123)
      assert.strictEqual(tag1, tag2)
    })

    it('generates different checksum for different timestamp', function () {
      const tag1 = createTagBlock(1234567890123)
      const tag2 = createTagBlock(9876543210987)
      assert.notStrictEqual(tag1, tag2)
    })
  })

  // ============================================================
  // stateMapping tests
  // ============================================================
  describe('stateMapping', function () {
    it('maps motoring to 0', function () {
      assert.strictEqual(stateMapping['motoring'], 0)
    })

    it('maps anchored to 1', function () {
      assert.strictEqual(stateMapping['anchored'], 1)
    })

    it('maps moored to 5', function () {
      assert.strictEqual(stateMapping['moored'], 5)
    })

    it('maps sailing to 8', function () {
      assert.strictEqual(stateMapping['sailing'], 8)
    })

    it('maps multiple variations of same state', function () {
      assert.strictEqual(stateMapping['UnderWayUsingEngine'], 0)
      assert.strictEqual(stateMapping['under way using engine'], 0)
      assert.strictEqual(stateMapping['underway using engine'], 0)
    })

    it('maps undefined to 15', function () {
      assert.strictEqual(stateMapping['undefined'], 15)
      assert.strictEqual(stateMapping['UnDefined'], 15)
    })
  })

  // ============================================================
  // getNavStatus tests
  // ============================================================
  describe('getNavStatus', function () {
    it('returns empty string for null', function () {
      assert.strictEqual(getNavStatus(null), '')
    })

    it('returns empty string for undefined', function () {
      assert.strictEqual(getNavStatus(undefined), '')
    })

    it('returns 0 for motoring', function () {
      assert.strictEqual(getNavStatus('motoring'), 0)
    })

    it('returns 8 for sailing', function () {
      assert.strictEqual(getNavStatus('sailing'), 8)
    })

    it('returns empty string for unknown state', function () {
      assert.strictEqual(getNavStatus('unknown_state'), '')
    })
  })

  // ============================================================
  // extractVesselData tests
  // ============================================================
  describe('extractVesselData', function () {
    it('extracts basic vessel data', function () {
      const vessel = {
        mmsi: '123456789',
        name: 'Test Vessel',
        navigation: {
          position: {
            latitude: { value: 60.1 },
            longitude: { value: 24.9 }
          },
          speedOverGround: { value: 5.0 },
          courseOverGroundTrue: { value: Math.PI / 2 }
        },
        sensors: {
          ais: {
            class: { value: 'A' }
          }
        }
      }

      const data = extractVesselData(vessel)

      assert.strictEqual(data.mmsi, '123456789')
      assert.strictEqual(data.shipName, 'Test Vessel')
      assert.strictEqual(data.lat, 60.1)
      assert.strictEqual(data.lon, 24.9)
      assert(Math.abs(data.sog - 9.719) < 0.01) // 5 m/s in knots
      assert.strictEqual(data.cog, 90) // PI/2 in degrees
      assert.strictEqual(data.aisClass, 'A')
    })

    it('handles missing optional fields', function () {
      const vessel = {
        mmsi: '123456789',
        navigation: {
          position: {
            latitude: { value: 60.1 },
            longitude: { value: 24.9 }
          }
        }
      }

      const data = extractVesselData(vessel)

      assert.strictEqual(data.mmsi, '123456789')
      assert.strictEqual(data.lat, 60.1)
      assert.strictEqual(data.lon, 24.9)
      assert.strictEqual(data.sog, null)
      assert.strictEqual(data.cog, null)
      assert.strictEqual(data.shipName, null)
    })

    it('converts numeric shipName to empty string', function () {
      const vessel = {
        mmsi: '123456789',
        name: 12345
      }

      const data = extractVesselData(vessel)
      assert.strictEqual(data.shipName, '')
    })

    it('extracts IMO with prefix removed', function () {
      const vessel = {
        mmsi: '123456789',
        registrations: {
          imo: { value: 'IMO 9876543' }
        }
      }

      const data = extractVesselData(vessel)
      assert.strictEqual(data.imo, '9876543')
    })

    it('handles beam division by 2', function () {
      const vessel = {
        mmsi: '123456789',
        design: {
          beam: { value: 10 }
        }
      }

      const data = extractVesselData(vessel)
      assert.strictEqual(data.beam, 5)
    })

    it('handles draft division by 10', function () {
      const vessel = {
        mmsi: '123456789',
        design: {
          draft: {
            current: { value: 30 }
          }
        }
      }

      const data = extractVesselData(vessel)
      assert.strictEqual(data.draftCur, 3)
    })
  })

  // ============================================================
  // AIS Message builders tests
  // ============================================================
  describe('buildAisMessage3 (Class A position)', function () {
    const testData = {
      mmsi: '123456789',
      lat: 60.1,
      lon: 24.9,
      sog: 10.5,
      cog: 180,
      hdg: 175,
      rot: 0.5,
      navStat: 0
    }

    it('builds message with correct aistype', function () {
      const msg = buildAisMessage3(testData, false)
      assert.strictEqual(msg.aistype, 3)
    })

    it('sets own flag correctly', function () {
      const msgOwn = buildAisMessage3(testData, true)
      const msgOther = buildAisMessage3(testData, false)
      assert.strictEqual(msgOwn.own, true)
      assert.strictEqual(msgOther.own, false)
    })

    it('includes all required fields', function () {
      const msg = buildAisMessage3(testData, false)
      assert.strictEqual(msg.mmsi, '123456789')
      assert.strictEqual(msg.lat, 60.1)
      assert.strictEqual(msg.lon, 24.9)
      assert.strictEqual(msg.sog, 10.5)
      assert.strictEqual(msg.cog, 180)
      assert.strictEqual(msg.hdg, 175)
      assert.strictEqual(msg.rot, 0.5)
      assert.strictEqual(msg.navstatus, 0)
      assert.strictEqual(msg.repeat, 0)
    })
  })

  describe('buildAisMessage5 (Class A static)', function () {
    const testData = {
      mmsi: '123456789',
      imo: '9876543',
      id: 70,
      callSign: 'ABCD',
      shipName: 'Test Ship',
      draftCur: 3.5,
      dst: 'Helsinki',
      length: 50,
      beam: 8
    }

    it('builds message with correct aistype', function () {
      const msg = buildAisMessage5(testData, false)
      assert.strictEqual(msg.aistype, 5)
    })

    it('includes all required fields', function () {
      const msg = buildAisMessage5(testData, false)
      assert.strictEqual(msg.mmsi, '123456789')
      assert.strictEqual(msg.imo, '9876543')
      assert.strictEqual(msg.cargo, 70)
      assert.strictEqual(msg.callsign, 'ABCD')
      assert.strictEqual(msg.shipname, 'Test Ship')
      assert.strictEqual(msg.draught, 3.5)
      assert.strictEqual(msg.destination, 'Helsinki')
      assert.strictEqual(msg.dimA, 0)
      assert.strictEqual(msg.dimB, 50)
      assert.strictEqual(msg.dimC, 8)
      assert.strictEqual(msg.dimD, 8)
    })
  })

  describe('buildAisMessage18 (Class B position)', function () {
    const testData = {
      mmsi: '123456789',
      lat: 60.1,
      lon: 24.9,
      sog: 8.0,
      cog: 90,
      hdg: 85
    }

    it('builds message with correct aistype', function () {
      const msg = buildAisMessage18(testData, false)
      assert.strictEqual(msg.aistype, 18)
    })

    it('includes accuracy field set to 0', function () {
      const msg = buildAisMessage18(testData, false)
      assert.strictEqual(msg.accuracy, 0)
    })

    it('includes all required fields', function () {
      const msg = buildAisMessage18(testData, false)
      assert.strictEqual(msg.mmsi, '123456789')
      assert.strictEqual(msg.lat, 60.1)
      assert.strictEqual(msg.lon, 24.9)
      assert.strictEqual(msg.sog, 8.0)
      assert.strictEqual(msg.cog, 90)
      assert.strictEqual(msg.hdg, 85)
    })
  })

  describe('buildAisMessage24A (Class B static part A)', function () {
    const testData = {
      mmsi: '123456789',
      shipName: 'Test Boat'
    }

    it('builds message with correct aistype', function () {
      const msg = buildAisMessage24A(testData, false)
      assert.strictEqual(msg.aistype, 24)
    })

    it('sets part to 0', function () {
      const msg = buildAisMessage24A(testData, false)
      assert.strictEqual(msg.part, 0)
    })

    it('includes ship name', function () {
      const msg = buildAisMessage24A(testData, false)
      assert.strictEqual(msg.shipname, 'Test Boat')
    })
  })

  describe('buildAisMessage24B (Class B static part B)', function () {
    const testData = {
      mmsi: '123456789',
      id: 36,
      callSign: 'XYZ',
      length: 12,
      beam: 4
    }

    it('builds message with correct aistype', function () {
      const msg = buildAisMessage24B(testData, false)
      assert.strictEqual(msg.aistype, 24)
    })

    it('sets part to 1', function () {
      const msg = buildAisMessage24B(testData, false)
      assert.strictEqual(msg.part, 1)
    })

    it('includes all required fields', function () {
      const msg = buildAisMessage24B(testData, false)
      assert.strictEqual(msg.mmsi, '123456789')
      assert.strictEqual(msg.cargo, 36)
      assert.strictEqual(msg.callsign, 'XYZ')
      assert.strictEqual(msg.dimA, 0)
      assert.strictEqual(msg.dimB, 12)
      assert.strictEqual(msg.dimC, 4)
      assert.strictEqual(msg.dimD, 4)
    })
  })

  // ============================================================
  // isDataFresh tests
  // ============================================================
  describe('isDataFresh', function () {
    it('returns false for null timestamp', function () {
      assert.strictEqual(isDataFresh(null, 60), false)
    })

    it('returns false for undefined timestamp', function () {
      assert.strictEqual(isDataFresh(undefined, 60), false)
    })

    it('returns true for recent timestamp', function () {
      const recentTime = new Date(Date.now() - 10000).toISOString() // 10 seconds ago
      assert.strictEqual(isDataFresh(recentTime, 60), true)
    })

    it('returns false for old timestamp', function () {
      const oldTime = new Date(Date.now() - 120000).toISOString() // 2 minutes ago
      assert.strictEqual(isDataFresh(oldTime, 60), false)
    })

    it('returns true for timestamp exactly at boundary', function () {
      const boundaryTime = new Date(Date.now() - 30000).toISOString() // 30 seconds ago
      assert.strictEqual(isDataFresh(boundaryTime, 60), true)
    })

    it('respects different maxAge values', function () {
      const time = new Date(Date.now() - 45000).toISOString() // 45 seconds ago
      assert.strictEqual(isDataFresh(time, 60), true)  // 60s max -> fresh
      assert.strictEqual(isDataFresh(time, 30), false) // 30s max -> stale
    })
  })
})
