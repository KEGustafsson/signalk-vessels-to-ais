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
const AisEncode = require("ggencoder").AisEncode

module.exports = function createPlugin(app) {
  const plugin = {};
  plugin.id = 'signalk-vessels-to-ais';
  plugin.name = 'Other vessels data to AIS NMEA0183';
  plugin.description = 'SignalK server plugin to convert other vessel data to NMEA0183 AIS format and forward it out to 3rd party applications';

  var position_update = null;
  var url;
  var interval_id1;
  var interval_id2;
  var unsubscribes = [];

plugin.start = function (options, restartPlugin) {

  position_update = options.position_update
  app.debug('Plugin started');

  interval_id1 = setInterval(read_info,(15000));
  setTimeout(clear, 15000);
  interval_id2 = setInterval(read_info,(position_update * 60000));

  };

//----------------------------------------------------------------------------
// State Mapping

let stateMapping = {
  'motoring': 0,
  'anchored': 1,
  'not under command': 2,
  'restricted manouverability': 3,
  'constrained by draft': 4,
  'moored': 5,
  'aground': 6,
  'fishing': 7,
  'sailing': 8,
  'hazardous material high speed': 9,
  'hazardous material wing in ground': 10,
  'ais-sart': 14,
  'default': 15
}

//----------------------------------------------------------------------------
// Rad to Deg
function radians_to_degrees(radians)
{
  var pi = Math.PI;
  return ((radians * 180)/pi);
}

//----------------------------------------------------------------------------
// m/s to  knots
function ms_to_knots(speed)
{
  return ((speed * 3.6) / 1.852);
}

//----------------------------------------------------------------------------
// Clear start interval

  function clear() {
    clearInterval(interval_id1);
  };

//----------------------------------------------------------------------------
// json size
function lengthInUtf8Bytes(str,str2) {
  var m = encodeURIComponent(str).match(/%[89ABab]/g);
  return (((str.length + (m ? m.length : 0))/1024) + (str2*0.2)).toFixed(1);
}

//----------------------------------------------------------------------------
// nmea out

function ais_out(enc_msg) {
  var enc= new AisEncode(enc_msg)
  var sentence = enc.nmea
  if ( sentence && sentence.length > 0 )
  {
    app.debug(sentence);
    app.emit('nmea0183out', sentence);
  }
}

//----------------------------------------------------------------------------
// Read and parse AIS data

  read_info = function read_data() {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        var url ="http://localhost:3000/signalk/v1/api/vessels";

        fetch(url, { method: 'GET'})
          .then((res) => {
             return res.json()
        })
        .then((json) => {
          var jsonContent = JSON.parse(JSON.stringify(json));
          var numberAIS = Object.keys(jsonContent).length;
          for (i = 1; i < numberAIS; i++) {
            var jsonKey = Object.keys(jsonContent)[i];

            try { var mmsi = jsonContent[jsonKey].mmsi;} catch (error) {mmsi = null;};
            try { var name = jsonContent[jsonKey].name;} catch (error) {name = "";};
            try { var lat = jsonContent[jsonKey].navigation.position.value.latitude;} catch (error) {lat = null ;};
            try { var lon = jsonContent[jsonKey].navigation.position.value.longitude;} catch (error) {lon = null;};
            try { var sog = ms_to_knots(jsonContent[jsonKey].navigation.speedOverGround.value);} catch (error) {sog = null;};
            try { var cog = radians_to_degrees(jsonContent[jsonKey].navigation.courseOverGroundTrue.value);} catch (error) {cog = null;};
            try { var rot = radians_to_degrees(jsonContent[jsonKey].navigation.rateOfTurn.value);} catch (error) {rot = null;};
            try { var navStat = stateMapping[jsonContent[jsonKey].navigation.state.value];} catch (error) {navStat = "";};
            try { var hdg = radians_to_degrees(jsonContent[jsonKey].navigation.headingTrue.value);} catch (error) {hdg = null;};
            try { var dst = jsonContent[jsonKey].navigation.destination.commonName.value;} catch (error) {dst = "";};
            try { var callSign = jsonContent[jsonKey].communication.callsignVhf;} catch (error) {callSign = "";};
            try { var imo = (jsonContent[jsonKey].registrations.imo).substring(4, 20);} catch (error) {imo = null;};
            try { var id = jsonContent[jsonKey].design.aisShipType.value.id;} catch (error) {id = null;};
            try { var type = jsonContent[jsonKey].design.aisShipType.value.name;} catch (error) {type = "";};
            try { var draft_cur = (jsonContent[jsonKey].design.draft.value.current)/10;} catch (error) {draft_cur = null;};
            try { var length = jsonContent[jsonKey].design.length.value.overall;} catch (error) {length = null;};
            try { var beam = (jsonContent[jsonKey].design.beam.value)/2;} catch (error) {beam = null;};
            try { var ais = jsonContent[jsonKey].sensors.ais.class.value;} catch (error) {ais = null;};

            if (name % 1 == 0) {
               name = "";
            }
            if (navStat % 1 == 0) {
               navStat = "";
            }
            if (dst % 1 == 0) {
               dst = "";
            }
            if (callSign % 1 == 0) {
               callSign = "";
            }
            if (type % 1 == 0) {
               type = "";
            }

            enc_msg_3 = {
              aistype: 3, // class A position report
              repeat: 0,
              mmsi: mmsi,
              navstatus: navStat,
              sog: sog,
              lon: lon,
              lat: lat,
              cog: cog,
              hdg: hdg,
              rot: rot
            }

            enc_msg_5 = {
              aistype: 5, //class A static
              repeat: 0,
              mmsi: mmsi,
              imo: imo,
              cargo: id,
              callsign: callSign,
              shipname: name,
              draught: draft_cur,
              destination: dst,
              dimA: 0,
              dimB: length,
              dimC: beam,
              dimD: beam
            }

            enc_msg_18 = {
              aistype: 18, // class B position report
              repeat: 0,
              mmsi: mmsi,
              sog: sog,
              accuracy: 0,
              lon: lon,
              lat: lat,
              cog: cog,
              hdg: hdg
            }

            enc_msg_24_0 = {
              aistype: 24, // class B static
              repeat: 0,
              part: 0,
              mmsi: mmsi,
              shipname: name
            }

            enc_msg_24_1 = {
              aistype: 24, // class B static
              repeat: 0,
              part: 1,
              mmsi: mmsi,
              cargo: id,
              callsign: callSign,
              dimA: 0,
              dimB: length,
              dimC: beam,
              dimD: beam
            }

            if (ais == "A") {
               app.debug("class A " + i);
               ais_out(enc_msg_3);
               ais_out(enc_msg_5);
            }
            if (ais == "B") {
               app.debug("class B " + i);
               ais_out(enc_msg_18);
               ais_out(enc_msg_24_0);
               ais_out(enc_msg_24_1);
            }

          }
        var dateobj = new Date( Date.now());
        var date = dateobj.toISOString();
        app.handleMessage(plugin.id, {
          context: `vessels.${app.selfId}`,
          updates: [
          ]
        });
        app.setProviderStatus(`Number of AIS targets sent: ${numberAIS-1} (${date})`);
        })
        .catch(err => console.error(err));

  };

//----------------------------------------------------------------------------

  plugin.stop = function stop() {
    clearInterval(interval_id2);
    app.debug('Stopped');
  };

  plugin.schema = {
    type: 'object',
    properties: {
      position_update: {
        type: 'integer',
        default: 1,
        title: 'How often AIS data is sent to NMEA0183 out (in minutes)',
      }
    },
  };

  return plugin;
};
