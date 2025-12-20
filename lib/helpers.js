/* eslint-disable no-bitwise */
/**
 * Helper functions for signalk-vessels-to-ais-ws plugin
 * Extracted for testability
 */

// State Mapping - AIS navigation status codes
const stateMapping = {
  motoring: 0,
  UnderWayUsingEngine: 0,
  'under way using engine': 0,
  'underway using engine': 0,
  anchored: 1,
  AtAnchor: 1,
  'at anchor': 1,
  'not under command': 2,
  'restricted manouverability': 3,
  'constrained by draft': 4,
  'constrained by her draught': 4,
  moored: 5,
  Moored: 5,
  aground: 6,
  fishing: 7,
  'engaged in fishing': 7,
  sailing: 8,
  UnderWaySailing: 8,
  'under way sailing': 8,
  'underway sailing': 8,
  'hazardous material high speed': 9,
  'hazardous material wing in ground': 10,
  'reserved for future use': 13,
  'ais-sart': 14,
  default: 15,
  UnDefined: 15,
  undefined: 15
}

/**
 * Extract value from SignalK data structure
 * Handles both { value: X } objects and direct values
 * @param {object} obj - The object to extract from
 * @param {string} path - Dot-separated path (e.g., 'navigation.position.latitude')
 * @returns {*} The extracted value or null
 */
function getValue(obj, path) {
  if (obj === undefined || obj === null) return null

  const parts = path.split('.')
  let current = obj

  for (const part of parts) {
    if (current === undefined || current === null) return null
    current = current[part]
  }

  if (current === undefined || current === null) return null

  // Handle SignalK value wrapper
  if (typeof current === 'object' && 'value' in current) {
    return current.value
  }

  return current
}

/**
 * Get timestamp from SignalK data
 * @param {object} obj - The object to extract from
 * @param {string} path - Dot-separated path
 * @returns {string|null} ISO timestamp or null
 */
function getTimestamp(obj, path) {
  if (obj === undefined || obj === null) return null

  const parts = path.split('.')
  let current = obj

  for (const part of parts) {
    if (current === undefined || current === null) return null
    current = current[part]
  }

  if (current === undefined || current === null) return null

  if (typeof current === 'object' && 'timestamp' in current) {
    return current.timestamp
  }

  return null
}

/**
 * Convert radians to degrees
 * @param {number|null} radians - Value in radians
 * @returns {number|null} Value in degrees or null
 */
function radToDegrees(radians) {
  if (radians === null || radians === undefined) return null
  return (radians * 180) / Math.PI
}

/**
 * Convert meters per second to knots
 * @param {number|null} speed - Speed in m/s
 * @returns {number|null} Speed in knots or null
 */
function msToKnots(speed) {
  if (speed === null || speed === undefined) return null
  return (speed * 3.6) / 1.852
}

// NMEA checksum hex conversion
const mHex = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F']

/**
 * Convert byte to hex string
 * @param {number} v - Byte value
 * @returns {string} Two-character hex string
 */
function toHexString(v) {
  const msn = (v >> 4) & 0x0f
  const lsn = (v >> 0) & 0x0f
  return mHex[msn] + mHex[lsn]
}

/**
 * Create NMEA tag block with checksum
 * @param {number} [timestamp] - Optional timestamp (defaults to Date.now())
 * @returns {string} Tag block string
 */
function createTagBlock(timestamp) {
  let tagBlock = ''
  tagBlock += 's:SK0001,'
  tagBlock += `c:${timestamp || Date.now()},`
  tagBlock = tagBlock.slice(0, -1)
  let tagBlockChecksum = 0
  for (let i = 0; i < tagBlock.length; i++) {
    tagBlockChecksum ^= tagBlock.charCodeAt(i)
  }
  return `\\${tagBlock}*${toHexString(tagBlockChecksum)}\\`
}

/**
 * Get navigation status code from state string
 * @param {string} state - Navigation state string
 * @returns {number|string} AIS navigation status code or empty string
 */
function getNavStatus(state) {
  if (state === null || state === undefined) return ''
  return stateMapping[state] !== undefined ? stateMapping[state] : ''
}

/**
 * Extract vessel data from SignalK vessel object
 * @param {object} vessel - SignalK vessel object
 * @returns {object} Extracted vessel data
 */
function extractVesselData(vessel) {
  const mmsi = getValue(vessel, 'mmsi')
  let shipName = getValue(vessel, 'name')
  if (typeof shipName === 'number') shipName = ''

  const lat = getValue(vessel, 'navigation.position.latitude')
  const lon = getValue(vessel, 'navigation.position.longitude')

  const sog = msToKnots(getValue(vessel, 'navigation.speedOverGround'))
  const cog = radToDegrees(getValue(vessel, 'navigation.courseOverGroundTrue'))
  const rot = radToDegrees(getValue(vessel, 'navigation.rateOfTurn'))
  const hdg = radToDegrees(getValue(vessel, 'navigation.headingTrue'))

  const navStateValue = getValue(vessel, 'navigation.state')
  const navStat = getNavStatus(navStateValue)

  let dst = getValue(vessel, 'navigation.destination.commonName')
  if (typeof dst === 'number') dst = ''

  let callSign = getValue(vessel, 'communication.callsignVhf')
  if (typeof callSign === 'number') callSign = ''

  let imo = getValue(vessel, 'registrations.imo')
  if (imo && typeof imo === 'string' && imo.startsWith('IMO ')) {
    imo = imo.substring(4)
  }

  const id = getValue(vessel, 'design.aisShipType.id')
  let type = getValue(vessel, 'design.aisShipType.name')
  if (typeof type === 'number') type = ''

  let draftCur = getValue(vessel, 'design.draft.current')
  if (draftCur !== null) draftCur = draftCur / 10

  const length = getValue(vessel, 'design.length.overall')
  let beam = getValue(vessel, 'design.beam')
  if (beam !== null) beam = beam / 2

  const aisClass = getValue(vessel, 'sensors.ais.class')

  return {
    mmsi,
    shipName,
    lat,
    lon,
    sog,
    cog,
    rot,
    hdg,
    navStat,
    dst,
    callSign,
    imo,
    id,
    type,
    draftCur,
    length,
    beam,
    aisClass
  }
}

/**
 * Build AIS message type 3 (Class A position report)
 * @param {object} data - Vessel data
 * @param {boolean} isOwn - Whether this is own vessel
 * @returns {object} AIS message object
 */
function buildAisMessage3(data, isOwn = false) {
  return {
    own: isOwn,
    aistype: 3,
    repeat: 0,
    mmsi: data.mmsi,
    navstatus: data.navStat,
    sog: data.sog,
    lon: data.lon,
    lat: data.lat,
    cog: data.cog,
    hdg: data.hdg,
    rot: data.rot
  }
}

/**
 * Build AIS message type 5 (Class A static data)
 * @param {object} data - Vessel data
 * @param {boolean} isOwn - Whether this is own vessel
 * @returns {object} AIS message object
 */
function buildAisMessage5(data, isOwn = false) {
  return {
    own: isOwn,
    aistype: 5,
    repeat: 0,
    mmsi: data.mmsi,
    imo: data.imo,
    cargo: data.id,
    callsign: data.callSign,
    shipname: data.shipName,
    draught: data.draftCur,
    destination: data.dst,
    dimA: 0,
    dimB: data.length,
    dimC: data.beam,
    dimD: data.beam
  }
}

/**
 * Build AIS message type 18 (Class B position report)
 * @param {object} data - Vessel data
 * @param {boolean} isOwn - Whether this is own vessel
 * @returns {object} AIS message object
 */
function buildAisMessage18(data, isOwn = false) {
  return {
    own: isOwn,
    aistype: 18,
    repeat: 0,
    mmsi: data.mmsi,
    sog: data.sog,
    accuracy: 0,
    lon: data.lon,
    lat: data.lat,
    cog: data.cog,
    hdg: data.hdg
  }
}

/**
 * Build AIS message type 24 part A (Class B static - ship name)
 * @param {object} data - Vessel data
 * @param {boolean} isOwn - Whether this is own vessel
 * @returns {object} AIS message object
 */
function buildAisMessage24A(data, isOwn = false) {
  return {
    own: isOwn,
    aistype: 24,
    repeat: 0,
    part: 0,
    mmsi: data.mmsi,
    shipname: data.shipName
  }
}

/**
 * Build AIS message type 24 part B (Class B static - call sign, dimensions)
 * @param {object} data - Vessel data
 * @param {boolean} isOwn - Whether this is own vessel
 * @returns {object} AIS message object
 */
function buildAisMessage24B(data, isOwn = false) {
  return {
    own: isOwn,
    aistype: 24,
    repeat: 0,
    part: 1,
    mmsi: data.mmsi,
    cargo: data.id,
    callsign: data.callSign,
    dimA: 0,
    dimB: data.length,
    dimC: data.beam,
    dimD: data.beam
  }
}

/**
 * Check if AIS data is fresh (within update interval)
 * @param {string} aisTime - ISO timestamp
 * @param {number} maxAgeSeconds - Maximum age in seconds
 * @returns {boolean} True if data is fresh
 */
function isDataFresh(aisTime, maxAgeSeconds) {
  if (!aisTime) return false
  const ageSeconds = (Date.now() - new Date(aisTime).getTime()) / 1000
  return ageSeconds < maxAgeSeconds
}

module.exports = {
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
}
