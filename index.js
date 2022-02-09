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

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const https = require('https');
const AisEncode = require('ggencoder').AisEncode;
const moment = require('moment');
const haversine = require('haversine-distance');

module.exports = function createPlugin(app) {
  const plugin = {};
  plugin.id = 'signalk-vessels-to-ais';
  plugin.name = 'Other vessels data to AIS NMEA0183';
  plugin.description = 'SignalK server plugin to convert other vessel data to NMEA0183 AIS format and forward it out to 3rd party applications';

  let positionUpdate = null;
  let distance;
  let sendOwn;
  let url;
  let intervalRun;
  const setStatus = app.setPluginStatus || app.setProviderStatus;

  let position_update;
  let useTag;

  const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
  });

  let getParam;

  plugin.start = function (options, restartPlugin) {
    position_update = options.position_update * 60;
    useTag = options.useTag;

    positionUpdate = options.position_update;
    distance = options.distance;
    sendOwn = options.sendOwn;

    let port = options.port || 3000;
    let portSec = options.portSec || 3443;

    url = 'https://localhost:' + portSec + '/signalk/v1/api/vessels';
    getParam = { method: 'GET', agent: httpsAgent };
    fetch(url, getParam)
      .then((res) => {
        console.log(`${plugin.id}: SSL enabled, using https`);
        if (!res.ok) {
          console.error(`${plugin.id}: SSL enabled, but error accessing server. Check 'Allow Readonly Access' and enable it.`);
          setStatus("Error accessing server. Check 'Allow Readonly Access' and enable it");
        }
      })
      .catch(() => {
        url = 'http://localhost:' + port + '/signalk/v1/api/vessels';
        getParam = { method: 'GET' };
        fetch(url, getParam)
          .then((res) => {
            console.log(`${plugin.id}: SSL disabled, using http`);
            if (!res.ok) {
              console.error(`${plugin.id}: SSL disabled, but error accessing server. Check 'Allow Readonly Access' and enable it.`);
              setStatus("Error accessing server. Check 'Allow Readonly Access' and enable it");
            }
          })
      })
      .finally(() => {
        intervalRun = setInterval(readData, (positionUpdate * 60000), getParam);
      });

    app.debug('Plugin started');

  };

  //----------------------------------------------------------------------------
  // State Mapping

  const stateMapping = {
    motoring: 0,
    anchored: 1,
    'not under command': 2,
    'restricted manouverability': 3,
    'constrained by draft': 4,
    moored: 5,
    aground: 6,
    fishing: 7,
    sailing: 8,
    'hazardous material high speed': 9,
    'hazardous material wing in ground': 10,
    'ais-sart': 14,
    default: 15,
  };

  //----------------------------------------------------------------------------
  // Rad to Deg
  function radToDegrees(radians) {
    const pi = Math.PI;
    return ((radians * 180) / pi);
  }

  //----------------------------------------------------------------------------
  // m/s to  knots
  function msToKnots(speed) {
    return ((speed * 3.6) / 1.852);
  }

  //----------------------------------------------------------------------------
  // nmea out

  function aisOut(encMsg, aisTime) {
    const enc = new AisEncode(encMsg);
    const sentence = enc.nmea;
    let taggString = '';
    if (useTag) {
      taggString = createTagBlock(aisTime)
    } 
    if (sentence && sentence.length > 0) {
      app.debug(taggString+sentence);
      app.emit('nmea0183out', taggString+sentence);
    }
  }

  const m_hex = [
    '0',
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    'A',
    'B',
    'C',
    'D',
    'E',
    'F'
  ]
  
  function toHexString (v) {
    let msn = (v >> 4) & 0x0f
    let lsn = (v >> 0) & 0x0f
    return m_hex[msn] + m_hex[lsn]
  }

  function createTagBlock (aisTime) {
    let tagBlock = ''
    tagBlock += 's:SK0001,'
    //tagBlock += 'c:' + aisTime + ','
    tagBlock += 'c:' + Date.now(aisTime) + ','
    tagBlock = tagBlock.slice(0, - 1)
    let tagBlockChecksum = 0
    for (let i = 0; i < tagBlock.length; i++) {
      tagBlockChecksum ^= tagBlock.charCodeAt(i)
    }
    return `\\${tagBlock}*` + toHexString(tagBlockChecksum) + `\\`
  }

  //----------------------------------------------------------------------------
  // Read and parse AIS data

  function readData(getParam) {
      let i, mmsi, aisTime, aisDelay, shipName, lat, lon, sog, cog, rot, navStat, hdg, dst, callSign, imo, id, type;
      let draftCur, length, beam, ais, encMsg3, encMsg5, encMsg18, encMsg240, encMsg241, own;
      let ownLat = app.getSelfPath('navigation.position.value.latitude');
      let ownLon = app.getSelfPath('navigation.position.value.longitude');
      fetch(url, getParam)
        .then((res) => res.json())
        .then((json) => {
          const jsonContent = JSON.parse(JSON.stringify(json));
          const numberAIS = Object.keys(jsonContent).length;
          for (i = 0; i < numberAIS; i++) {
            const jsonKey = Object.keys(jsonContent)[i];
  
            try {
              aisTime = jsonContent[jsonKey].sensors.ais.class.timestamp;
            } catch (error) {
              if (i === 0) {
                aisTime =  jsonContent[jsonKey].navigation.position.timestamp;
              } else {
                aisTime = null;
              }
            }

            if ((parseFloat((moment(new Date(Date.now())).diff(aisTime)/1000).toFixed(3))) < position_update) {
              aisDelay = true;
            } else {
              aisDelay = false;
            }

            try {
              mmsi = jsonContent[jsonKey].mmsi;
            } catch (error) { mmsi = null; }
            try {
              shipName = jsonContent[jsonKey].name;
            } catch (error) { shipName = ''; }
            try {
              lat = jsonContent[jsonKey].navigation.position.value.latitude;
            } catch (error) { lat = null; }
            try {
              lon = jsonContent[jsonKey].navigation.position.value.longitude;
            } catch (error) { lon = null; }
            try {
              sog = msToKnots(jsonContent[jsonKey].navigation.speedOverGround.value);
            } catch (error) { sog = null; }
            try {
              cog = radToDegrees(jsonContent[jsonKey].navigation.courseOverGroundTrue.value);
            } catch (error) { cog = null; }
            try {
              rot = radToDegrees(jsonContent[jsonKey].navigation.rateOfTurn.value);
            } catch (error) { rot = null; }
            try {
              navStat = stateMapping[jsonContent[jsonKey].navigation.state.value];
            } catch (error) { navStat = ''; }
            try {
              hdg = radToDegrees(jsonContent[jsonKey].navigation.headingTrue.value);
            } catch (error) { hdg = null; }
            try {
              dst = jsonContent[jsonKey].navigation.destination.commonName.value;
            } catch (error) { dst = ''; }
            try {
              if (i === 0) {
                callSign = jsonContent[jsonKey].communication.callsignVhf;
              } else {
                callSign = jsonContent[jsonKey].communication.value.callsignVhf;
              }
            } catch (error) { callSign = ''; }
            try {
              imo = (jsonContent[jsonKey].registrations.value.imo).substring(4, 20);
            } catch (error) { imo = null; }
            try {
              id = jsonContent[jsonKey].design.aisShipType.value.id;
            } catch (error) { id = null; }
            try {
              type = jsonContent[jsonKey].design.aisShipType.value.name;
            } catch (error) { type = ''; }
            try {
              draftCur = (jsonContent[jsonKey].design.draft.value.current) / 10;
            } catch (error) { draftCur = null; }
            try {
              length = jsonContent[jsonKey].design.length.value.overall;
            } catch (error) { length = null; }
            try {
              beam = (jsonContent[jsonKey].design.beam.value) / 2;
            } catch (error) { beam = null; }
            try {
              ais = jsonContent[jsonKey].sensors.ais.class.value;
            } catch (error) { ais = null; }
  
            if (shipName % 1 === 0) {
              shipName = '';
            }
            if (dst % 1 === 0) {
              dst = '';
            }
            if (callSign % 1 === 0) {
              callSign = '';
            }
            if (type % 1 === 0) {
              type = '';
            }
  
            if (i === 0) {
              own = true;
              if (sendOwn) {
                ais = 'A';
              } else {
                ais = '';
              }
            } else {
              own = false;
            }
  
            const a = { lat: ownLat, lon: ownLon }
            const b = { lat: lat, lon: lon }
            let dist = (haversine(a, b)/1000).toFixed(2);
  
            if (dist <= distance) {
              
              encMsg3 = {
                own,
                aistype: 3, // class A position report
                repeat: 0,
                mmsi,
                navstatus: navStat,
                sog,
                lon,
                lat,
                cog,
                hdg,
                rot,
              };
    
              encMsg5 = {
                own,
                aistype: 5, // class A static
                repeat: 0,
                mmsi,
                imo,
                cargo: id,
                callsign: callSign,
                shipname: shipName,
                draught: draftCur,
                destination: dst,
                dimA: 0,
                dimB: length,
                dimC: beam,
                dimD: beam,
              };
    
              encMsg18 = {
                own,
                aistype: 18, // class B position report
                repeat: 0,
                mmsi,
                sog,
                accuracy: 0,
                lon,
                lat,
                cog,
                hdg,
              };
    
              encMsg240 = {
                own,
                aistype: 24, // class B static
                repeat: 0,
                part: 0,
                mmsi,
                shipname: shipName,
              };
    
              encMsg241 = {
                own,
                aistype: 24, // class B static
                repeat: 0,
                part: 1,
                mmsi,
                cargo: id,
                callsign: callSign,
                dimA: 0,
                dimB: length,
                dimC: beam,
                dimD: beam,
              };
    
              if (aisDelay && (ais === 'A' || ais === 'B')) {
                app.debug("Distance range: " + distance + "km, AIS target distance: "  + dist + "km" + ", Class " + ais + " Vessel" + ", MMSI:" + mmsi)
                if (ais === 'A') {
                  app.debug(`class A, ${i}, time: ${aisTime}`);
                  aisOut(encMsg3, aisTime);
                  aisOut(encMsg5, aisTime);
                }
                if (ais === 'B') {
                  app.debug(`class B, ${i}, time: ${aisTime}`);
                  aisOut(encMsg18, aisTime);
                  aisOut(encMsg240, aisTime);
                  aisOut(encMsg241, aisTime);
                }
                app.debug("--------------------------------------------------------");
  
              }
            }
          }
          const dateobj = new Date(Date.now());
          const date = dateobj.toISOString();
          app.handleMessage(plugin.id, {
            context: `vessels.${app.selfId}`,
            updates: [
            ],
          });
          setStatus(`AIS NMEA message send: ${date}`);
        })
        .catch((err) => console.error(err));
  };

  //----------------------------------------------------------------------------

  plugin.stop = function stop() {
    clearInterval(intervalRun);
    app.debug('Stopped');
  };

  plugin.schema = {
    type: 'object',
    properties: {
      position_update: {
        type: 'number',
        default: 1,
        title: 'How often AIS data is sent to NMEA0183 out (in minutes). E.g. 0.5 = 30s, 1 = 1min',
      },
      port: {
        type: 'number',
        title: 'HTTP port',
        default: 3000
      },
      portSec: {
        type: 'number',
        title: 'HTTPS port',
        default: 3443
      },
      sendOwn: {
        type: 'boolean',
        title: 'Send own AIS data, VDO',
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
        title: 'AIS target within range [km]',
      },
    },
  };

  return plugin;
};
