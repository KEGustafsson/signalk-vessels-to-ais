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

const fetch = require('node-fetch');
const AisEncode = require('ggencoder').AisEncode;

module.exports = function createPlugin(app) {
  const plugin = {};
  plugin.id = 'signalk-vessels-to-ais';
  plugin.name = 'Other vessels data to AIS NMEA0183';
  plugin.description = 'SignalK server plugin to convert other vessel data to NMEA0183 AIS format and forward it out to 3rd party applications';

  let positionUpdate = null;
  let sendOwn;
  let url;
  let intervalStart;
  let intervalRun;
  let readInfo;
  const setStatus = app.setPluginStatus || app.setProviderStatus;

  plugin.start = function (options, restartPlugin) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    url = 'https://localhost:3443/signalk/v1/api/vessels';
    fetch(url, { method: 'GET' })
      .then((res) => {
        console.log(`${plugin.id}: SSL enabled, using https`);
        if (!res.ok) {
          console.error(`${plugin.id}: SSL enabled, but error accessing server. Check 'Allow Readonly Access' and enable it.`);
          setStatus("Error accessing server. Check 'Allow Readonly Access' and enable it");
        }
      })
      .catch(() => {
        url = 'http://localhost:3000/signalk/v1/api/vessels';
        fetch(url, { method: 'GET' })
          .then((res) => {
            console.log(`${plugin.id}: SSL disabled, using http`);
            if (!res.ok) {
              console.error(`${plugin.id}: SSL disabled, but error accessing server. Check 'Allow Readonly Access' and enable it.`);
              setStatus("Error accessing server. Check 'Allow Readonly Access' and enable it");
            }
          })
          .catch(() => {
          });
      });

    positionUpdate = options.position_update;
    sendOwn = options.sendOwn;

    app.debug('Plugin started');

    function clear() {
      clearInterval(intervalStart);
    }

    intervalStart = setInterval(readInfo, (15000));
    setTimeout(clear, 15000);
    intervalRun = setInterval(readInfo, (positionUpdate * 60000));
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

  function aisOut(encMsg) {
    const enc = new AisEncode(encMsg);
    const sentence = enc.nmea;
    if (sentence && sentence.length > 0) {
      app.debug(sentence);
      app.emit('nmea0183out', sentence);
    }
  }

  //----------------------------------------------------------------------------
  // Read and parse AIS data

  readInfo = function readData(options) {
    let i, mmsi, shipName, lat, lon, sog, cog, rot, navStat, hdg, dst, callSign, imo, id, type;
    let draftCur, length, beam, ais, encMsg3, encMsg5, encMsg18, encMsg240, encMsg241, own;
    fetch(url, { method: 'GET' })
      .then((res) => res.json())
      .then((json) => {
        const jsonContent = JSON.parse(JSON.stringify(json));
        const numberAIS = Object.keys(jsonContent).length;
        for (i = 0; i < numberAIS; i++) {
          const jsonKey = Object.keys(jsonContent)[i];

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
            imo = (jsonContent[jsonKey].registrations.imo).substring(4, 20);
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
              ais = 'B';
            }
          } else {
            own = false;
          }

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

          if (ais === 'A') {
            app.debug(`class A ${i}`);
            aisOut(encMsg3);
            aisOut(encMsg5);
          }
          if (ais === 'B') {
            app.debug(`class B ${i}`);
            aisOut(encMsg18);
            aisOut(encMsg240);
            aisOut(encMsg241);
          }
          if (i === 0) {
            console.log(encMsg18)
            console.log(encMsg240)
            console.log(encMsg241)
          }
        }
        const dateobj = new Date(Date.now());
        const date = dateobj.toISOString();
        app.handleMessage(plugin.id, {
          context: `vessels.${app.selfId}`,
          updates: [
          ],
        });
        setStatus(`Number of AIS targets sent: ${numberAIS - 1} (${date})`);
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
      sendOwn: {
        type: 'boolean',
        title: 'Send own AIS data, VDO',
        default: true
      },
    },
  };

  return plugin;
};
