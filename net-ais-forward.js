const fetch = require('node-fetch');
const AisEncode = require("ggencoder").AisEncode

let address = "kotiubuntu.kg:3000";
let delay = 60000;
var jsonContent;

read_data();
setInterval(read_data, delay);

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
function kB(kB)
{
  return (kB / 1024).toFixed(1);
}

//----------------------------------------------------------------------------
function lengthInUtf8Bytes(str) {
  // Matches only the 10.. bytes that are non-initial characters in a multi-byte sequence.
  var m = encodeURIComponent(str).match(/%[89ABab]/g);
  return str.length + (m ? m.length : 0);
}

//----------------------------------------------------------------------------
function read_data() {
	var url ="http://"+ address +"/signalk/v1/api/vessels";

	fetch(url, { method: 'GET'})
	  .then((res) => {
	     return res.json()
	})
	.then((json) => {

          var dateobj = new Date( Date.now());
//          dateobj.setSeconds(0,0);
          var date = dateobj.toLocaleString('fi-FI', {});
//          var date = dateobj.toISOString();

	  var myJson = JSON.stringify(json);
//	  console.log(JSON.stringify(json,null,'\t'))
	  var jsonContent = JSON.parse(JSON.stringify(json));
	  var numberAIS = Object.keys(jsonContent).length;
	  console.log((numberAIS - 1) + " vessels");

          for (i = 1; i < numberAIS; i++) {
            var jsonKey = Object.keys(jsonContent)[i];

            console.log("---- AIS info from: "+ i +" ----");
            console.log("mmsi:", jsonContent[jsonKey].mmsi);
            console.log("name:", jsonContent[jsonKey].name);
            console.log("lat:", jsonContent[jsonKey].navigation.position.value.latitude);
            console.log("lon:", jsonContent[jsonKey].navigation.position.value.longitude);
            console.log("sog:", ms_to_knots(jsonContent[jsonKey].navigation.speedOverGround.value));
            console.log("cog:", radians_to_degrees(jsonContent[jsonKey].navigation.courseOverGroundTrue.value));
            console.log("navStat:", jsonContent[jsonKey].navigation.state.value);
            console.log("navStat_nr:", stateMapping[jsonContent[jsonKey].navigation.state.value]);
            console.log("rot:", radians_to_degrees(jsonContent[jsonKey].navigation.rateOfTurn.value));
            console.log("heading:", radians_to_degrees(jsonContent[jsonKey].navigation.headingTrue.value));
            console.log("destination:", jsonContent[jsonKey].navigation.destination.commonName.value);
//            console.log("eta:", jsonContent[jsonKey].navigation.destination.eta.value);
            console.log("callSign:", jsonContent[jsonKey].communication.callsignVhf);
            console.log("imo:", (jsonContent[jsonKey].registrations.imo).substring(4, 20));
            console.log("id:", jsonContent[jsonKey].design.aisShipType.value.id);
            console.log("type:", jsonContent[jsonKey].design.aisShipType.value.name);
            console.log("ais class:", jsonContent[jsonKey].sensor.ais.class.value);
            console.log("draft_cur:", jsonContent[jsonKey].design.draft.value.current);
//            console.log("draft_max:", jsonContent[jsonKey].design.draft.value.maximum);
            console.log("lenght:", jsonContent[jsonKey].design.length.value.overall);
            console.log("beam:", jsonContent[jsonKey].design.beam.value);
            var imo_nr = (jsonContent[jsonKey].registrations.imo).substring(4, 20);

            enc_msg_3 = {
              aistype: 3, // class A position report
              repeat: 0,
              mmsi: jsonContent[jsonKey].mmsi,
              navstatus: stateMapping[jsonContent[jsonKey].navigation.state.value],
              sog: ms_to_knots(jsonContent[jsonKey].navigation.speedOverGround.value),
              lon: jsonContent[jsonKey].navigation.position.value.longitude,
              lat: jsonContent[jsonKey].navigation.position.value.latitude,
              cog: radians_to_degrees(jsonContent[jsonKey].navigation.courseOverGroundTrue.value),
              hdg: radians_to_degrees(jsonContent[jsonKey].navigation.headingTrue.value),
              rot: radians_to_degrees(jsonContent[jsonKey].navigation.rateOfTurn.value)
            }

            enc_msg_5 = {
              aistype: 5, //class A static
              repeat: 0,
              mmsi: jsonContent[jsonKey].mmsi,
              imo: (jsonContent[jsonKey].registrations.imo).substring(4, 20),
              cargo: jsonContent[jsonKey].design.aisShipType.value.id,
              callsign: jsonContent[jsonKey].communication.callsignVhf,
              shipname: jsonContent[jsonKey].name,
              draught: jsonContent[jsonKey].design.draft.value.current/10,
              destination: jsonContent[jsonKey].navigation.destination.commonName.value,
              dimA: 0,
              dimB: jsonContent[jsonKey].design.length.value.overall,
              dimC: (jsonContent[jsonKey].design.beam.value)/2,
              dimD: (jsonContent[jsonKey].design.beam.value)/2
            }

            enc_msg_18 = {
              aistype: 18, // class B position report
              repeat: 0,
              mmsi: jsonContent[jsonKey].mmsi,
              sog: ms_to_knots(jsonContent[jsonKey].navigation.speedOverGround.value),
              accuracy: 0,
              lon: jsonContent[jsonKey].navigation.position.value.longitude,
              lat: jsonContent[jsonKey].navigation.position.value.latitude,
              cog: radians_to_degrees(jsonContent[jsonKey].navigation.courseOverGroundTrue.value),
              hdg: radians_to_degrees(jsonContent[jsonKey].navigation.headingTrue.value)
            }

            enc_msg_24_0 = {
              aistype: 24, // class B static
              repeat: 0,
              part: 0,
              mmsi: jsonContent[jsonKey].mmsi,
              shipname: jsonContent[jsonKey].name
            }

            enc_msg_24_1 = {
              aistype: 24, // class B static
              repeat: 0,
              part: 1,
              mmsi: jsonContent[jsonKey].mmsi,
              cargo: jsonContent[jsonKey].design.aisShipType.value.id,
              callsign: jsonContent[jsonKey].communication.callsignVhf,
              dimA: 0,
              dimB: jsonContent[jsonKey].design.length.value.overall,
              dimC: (jsonContent[jsonKey].design.beam.value)/2,
              dimD: (jsonContent[jsonKey].design.beam.value)/2
            }

            if (jsonContent[jsonKey].sensor.ais.class.value == "A") {
               ais_out(enc_msg_3);
               ais_out(enc_msg_5);
            }
            if (jsonContent[jsonKey].sensor.ais.class.value == "B") {
               ais_out(enc_msg_18);
               ais_out(enc_msg_24_0);
               ais_out(enc_msg_24_1);
            }

            console.log("---- AIS info from: "+ i +" ----");
            console.log("");


          }
            console.log("json size: "+ kB(lengthInUtf8Bytes(myJson))+"kB");
            console.log("Date: "+ date);


        })
        .catch(err => console.error(err));;

function ais_out(enc_msg) {
  var enc= new AisEncode(enc_msg)
  var sentence = enc.nmea
  if ( sentence && sentence.length > 0 )
  {
    console.log(sentence)
    //app.emit('nmea0183out', sentence)
  }
}

}
