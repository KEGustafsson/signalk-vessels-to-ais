/* eslint-disable no-bitwise */
/**
 * Helper functions for signalk-vessels-to-ais plugin
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
  undefined: 15,
};

/**
 * Extract value from SignalK data structure
 * Handles both { value: X } objects and direct values
 * @param {object} obj - The object to extract from
 * @param {string} path - Dot-separated path (e.g., 'navigation.position.latitude')
 * @returns {*} The extracted value or null
 */
function getValue(obj, path) {
  if (obj === undefined || obj === null) return null;

  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === undefined || current === null) return null;
    if (current[part] !== undefined) {
      current = current[part];
    } else if (
      typeof current === 'object'
      && current.value !== undefined
      && current.value !== null
      && typeof current.value === 'object'
      && current.value[part] !== undefined
    ) {
      current = current.value[part];
    } else {
      return null;
    }
  }

  if (current === undefined || current === null) return null;

  // Handle SignalK value wrapper
  if (typeof current === 'object' && 'value' in current) {
    return current.value;
  }

  return current;
}

/**
 * Get timestamp from SignalK data
 * @param {object} obj - The object to extract from
 * @param {string} path - Dot-separated path
 * @returns {string|null} ISO timestamp or null
 */
function getTimestamp(obj, path) {
  if (obj === undefined || obj === null) return null;

  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === undefined || current === null) return null;
    current = current[part];
  }

  if (current === undefined || current === null) return null;

  if (typeof current === 'object' && 'timestamp' in current) {
    return current.timestamp;
  }

  return null;
}

/**
 * Convert radians to degrees
 * @param {number|null} radians - Value in radians
 * @returns {number|null} Value in degrees or null
 */
function radToDegrees(radians) {
  if (radians === null || radians === undefined) return null;
  return (radians * 180) / Math.PI;
}

/**
 * Convert meters per second to knots
 * @param {number|null} speed - Speed in m/s
 * @returns {number|null} Speed in knots or null
 */
function msToKnots(speed) {
  if (speed === null || speed === undefined) return null;
  return (speed * 3.6) / 1.852;
}

// NMEA checksum hex conversion
const mHex = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];

/**
 * Convert byte to hex string
 * @param {number} v - Byte value
 * @returns {string} Two-character hex string
 */
function toHexString(v) {
  const msn = (v >> 4) & 0x0f;
  const lsn = (v >> 0) & 0x0f;
  return mHex[msn] + mHex[lsn];
}

/**
 * Create NMEA tag block with checksum
 * @param {number} [timestamp] - Optional timestamp (defaults to Date.now())
 * @returns {string} Tag block string
 */
function createTagBlock(timestamp) {
  let tagBlock = '';
  tagBlock += 's:SK0001,';
  tagBlock += `c:${timestamp || Date.now()},`;
  tagBlock = tagBlock.slice(0, -1);
  let tagBlockChecksum = 0;
  for (let i = 0; i < tagBlock.length; i++) {
    tagBlockChecksum ^= tagBlock.charCodeAt(i);
  }
  return `\\${tagBlock}*${toHexString(tagBlockChecksum)}\\`;
}

/**
 * Get navigation status code from state string
 * @param {string} state - Navigation state string
 * @returns {number|string} AIS navigation status code or empty string
 */
function getNavStatus(state) {
  if (state === null || state === undefined) return '';
  return stateMapping[state] !== undefined ? stateMapping[state] : '';
}

function getFirstValue(obj, paths) {
  for (const path of paths) {
    const value = getValue(obj, path);
    if (value !== null) return value;
  }
  return null;
}

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function calculateDimensions(length, beam, fromBow, fromCenter) {
  const dimensions = {
    dimA: 0,
    dimB: 0,
    dimC: 0,
    dimD: 0,
  };

  const vesselLength = toFiniteNumber(length);
  if (vesselLength !== null && vesselLength > 0) {
    const totalLength = clamp(Math.round(vesselLength), 0, 1022);
    const antennaFromBow = toFiniteNumber(fromBow);
    const dimA = antennaFromBow !== null ? Math.round(antennaFromBow) : Math.round(totalLength / 2);
    dimensions.dimA = clamp(dimA, 0, Math.min(totalLength, 511));
    dimensions.dimB = clamp(totalLength - dimensions.dimA, 0, 511);
  }

  const vesselBeam = toFiniteNumber(beam);
  if (vesselBeam !== null && vesselBeam > 0) {
    const totalBeam = clamp(Math.round(vesselBeam), 0, 126);
    const antennaFromCenter = toFiniteNumber(fromCenter) || 0;
    const dimC = Math.round((vesselBeam / 2) + antennaFromCenter);
    dimensions.dimC = clamp(dimC, 0, Math.min(totalBeam, 63));
    dimensions.dimD = clamp(totalBeam - dimensions.dimC, 0, 63);
  }

  return dimensions;
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveNumber(value) {
  const number = toFiniteNumber(value);
  return number !== null && number > 0;
}

function hasDimensions(data) {
  return ['dimA', 'dimB', 'dimC', 'dimD'].some((path) => isPositiveNumber(data[path]));
}

function hasUsefulAisMessage5Data(data) {
  return hasText(data.shipName)
    || hasText(data.callSign)
    || hasText(data.imo)
    || isPositiveNumber(data.imo)
    || hasText(data.dst)
    || isPositiveNumber(data.id)
    || isPositiveNumber(data.draftCur)
    || hasDimensions(data);
}

function hasUsefulAisMessage24AData(data) {
  return hasText(data.shipName);
}

function hasUsefulAisMessage24BData(data) {
  return hasText(data.callSign)
    || isPositiveNumber(data.id)
    || hasDimensions(data);
}

/**
 * Walk a dot-separated path and return the raw SignalK node, without
 * unwrapping the `{ value: ... }` envelope the way getValue does.
 * @param {object} obj - The object to walk
 * @param {string} path - Dot-separated path
 * @returns {object|null} The node at that path, or null
 */
function getNode(obj, path) {
  if (obj === undefined || obj === null) return null;

  let current = obj;
  for (const part of path.split('.')) {
    if (current === undefined || current === null || typeof current !== 'object') return null;
    current = current[part];
  }

  if (current === undefined || current === null) return null;
  return current;
}

/**
 * Collect every source that has written a given path on a vessel.
 * SignalK records the most recent writer as `$source`, and once more than one
 * source has written the path, each contributor is also keyed under `values`.
 * @param {object} vessel - SignalK vessel object
 * @param {string} path - Dot-separated path, e.g. 'navigation.position'
 * @returns {string[]} Source identifiers, most recent writer first
 */
function getSources(vessel, path) {
  const node = getNode(vessel, path);
  if (node === null || typeof node !== 'object') return [];

  const sources = [];
  if (typeof node.$source === 'string' && node.$source.length > 0) {
    sources.push(node.$source);
  }
  if (node.values !== null && typeof node.values === 'object') {
    for (const key of Object.keys(node.values)) {
      if (!sources.includes(key)) sources.push(key);
    }
  }
  return sources;
}

/**
 * Parse the user-supplied comma separated source exclude list.
 * @param {string} value - e.g. 'maiana.AI, some-other.II'
 * @returns {string[]} Normalised (trimmed, lower-cased) source identifiers
 */
function parseExcludedSources(value) {
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

/**
 * Test a single source identifier against the exclude list. A source matches
 * either exactly, or on a dot boundary, so 'maiana' excludes 'maiana.AI'
 * without also excluding an unrelated 'maianaX.AI'.
 * @param {string} source - SignalK source identifier
 * @param {string[]} excluded - Output of parseExcludedSources
 * @returns {boolean} True if the source is excluded
 */
function isSourceExcluded(source, excluded) {
  if (typeof source !== 'string' || !Array.isArray(excluded) || excluded.length === 0) return false;
  const normalised = source.toLowerCase();
  return excluded.some((entry) => normalised === entry || normalised.startsWith(`${entry}.`));
}

/**
 * Decide whether a vessel should be skipped because its data already reaches
 * the NMEA0183 output by another route (e.g. a transponder that emits AIVDM
 * itself). Any excluded source on the path is enough: if such a source can see
 * the target at all it is already broadcasting it, and emitting a second copy
 * from another source would both duplicate it and relay the staler position.
 * @param {object} vessel - SignalK vessel object
 * @param {string[]} excluded - Output of parseExcludedSources
 * @param {string} [path] - Path whose sources decide it
 * @returns {boolean} True if the vessel should be skipped
 */
function isVesselExcluded(vessel, excluded, path = 'navigation.position') {
  if (!Array.isArray(excluded) || excluded.length === 0) return false;
  return getSources(vessel, path).some((source) => isSourceExcluded(source, excluded));
}

/**
 * Extract vessel data from SignalK vessel object
 * @param {object} vessel - SignalK vessel object
 * @returns {object} Extracted vessel data
 */
function extractVesselData(vessel) {
  const mmsi = getValue(vessel, 'mmsi');
  let shipName = getValue(vessel, 'name');
  if (shipName === null || typeof shipName === 'number') shipName = '';

  // Handle SignalK position structure: navigation.position.value = {latitude, longitude}
  const position = getValue(vessel, 'navigation.position');
  const lat = position && typeof position === 'object' ? position.latitude : null;
  const lon = position && typeof position === 'object' ? position.longitude : null;

  const sog = msToKnots(getValue(vessel, 'navigation.speedOverGround'));
  const cog = radToDegrees(getValue(vessel, 'navigation.courseOverGroundTrue'));
  const rot = radToDegrees(getValue(vessel, 'navigation.rateOfTurn'));
  const hdg = radToDegrees(getValue(vessel, 'navigation.headingTrue'));

  const navStateValue = getValue(vessel, 'navigation.state');
  const navStat = getNavStatus(navStateValue);

  let dst = getValue(vessel, 'navigation.destination.commonName');
  if (dst === null || typeof dst === 'number') dst = '';

  let callSign = getValue(vessel, 'communication.callsignVhf');
  if (callSign === null || typeof callSign === 'number') callSign = '';

  let imo = getValue(vessel, 'registrations.imo');
  if (imo === null) {
    imo = '';
  } else if (typeof imo === 'string' && imo.startsWith('IMO ')) {
    imo = imo.substring(4);
  }

  const id = getValue(vessel, 'design.aisShipType.id');
  let type = getValue(vessel, 'design.aisShipType.name');
  if (type === null || typeof type === 'number') type = '';

  // Draft in meters - ggencoder handles conversion to 0.1m units internally
  const draftCur = getFirstValue(vessel, [
    'design.draft.current',
    'design.draft.maximum',
  ]);

  const length = getValue(vessel, 'design.length.overall');
  const beam = getValue(vessel, 'design.beam');
  const fromBow = getValue(vessel, 'sensors.ais.fromBow');
  const fromCenter = getValue(vessel, 'sensors.ais.fromCenter');
  const dimensions = calculateDimensions(length, beam, fromBow, fromCenter);

  const aisClass = getValue(vessel, 'sensors.ais.class');

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
    fromBow,
    fromCenter,
    dimA: dimensions.dimA,
    dimB: dimensions.dimB,
    dimC: dimensions.dimC,
    dimD: dimensions.dimD,
    aisClass,
  };
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
    rot: data.rot,
  };
}

/**
 * Build AIS message type 5 (Class A static data)
 * @param {object} data - Vessel data
 * @param {boolean} isOwn - Whether this is own vessel
 * @returns {object} AIS message object
 */
function buildAisMessage5(data, isOwn = false) {
  const dimensions = data.dimA !== undefined
    ? data
    : calculateDimensions(data.length, data.beam, data.fromBow, data.fromCenter);

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
    dimA: dimensions.dimA,
    dimB: dimensions.dimB,
    dimC: dimensions.dimC,
    dimD: dimensions.dimD,
  };
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
    hdg: data.hdg,
  };
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
    shipname: data.shipName,
  };
}

/**
 * Build AIS message type 24 part B (Class B static - call sign, dimensions)
 * @param {object} data - Vessel data
 * @param {boolean} isOwn - Whether this is own vessel
 * @returns {object} AIS message object
 */
function buildAisMessage24B(data, isOwn = false) {
  const dimensions = data.dimA !== undefined
    ? data
    : calculateDimensions(data.length, data.beam, data.fromBow, data.fromCenter);

  return {
    own: isOwn,
    aistype: 24,
    repeat: 0,
    part: 1,
    mmsi: data.mmsi,
    cargo: data.id,
    callsign: data.callSign,
    dimA: dimensions.dimA,
    dimB: dimensions.dimB,
    dimC: dimensions.dimC,
    dimD: dimensions.dimD,
  };
}

/**
 * Check if AIS data is fresh (within update interval)
 * @param {string} aisTime - ISO timestamp
 * @param {number} maxAgeSeconds - Maximum age in seconds
 * @returns {boolean} True if data is fresh
 */
function isDataFresh(aisTime, maxAgeSeconds) {
  if (!aisTime) return false;
  const ageSeconds = (Date.now() - new Date(aisTime).getTime()) / 1000;
  return ageSeconds < maxAgeSeconds;
}

module.exports = {
  stateMapping,
  getValue,
  getTimestamp,
  getNode,
  getSources,
  parseExcludedSources,
  isSourceExcluded,
  isVesselExcluded,
  radToDegrees,
  msToKnots,
  toHexString,
  createTagBlock,
  getNavStatus,
  calculateDimensions,
  hasUsefulAisMessage5Data,
  hasUsefulAisMessage24AData,
  hasUsefulAisMessage24BData,
  extractVesselData,
  buildAisMessage3,
  buildAisMessage5,
  buildAisMessage18,
  buildAisMessage24A,
  buildAisMessage24B,
  isDataFresh,
};
