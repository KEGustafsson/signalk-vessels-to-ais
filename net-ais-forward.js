const fetch = require('node-fetch');
const AisEncode = require("ggencoder").AisEncode

let address = "kotiubuntu.kg:3000";
let delay = 60000;
var jsonContent;

read_data();
setInterval(read_data, delay);

//----------------------------------------------------------------------------
// Deg to Rad
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
//            console.log("rot:", jsonContent[jsonKey].navigation.rateOfTurn.value);
            console.log("heading:", jsonContent[jsonKey].navigation.headingTrue.value);
            console.log("destination:", jsonContent[jsonKey].navigation.destination.commonName.value);
//            console.log("eta:", jsonContent[jsonKey].navigation.destination.eta.value);
            console.log("callSign:", jsonContent[jsonKey].communication.callsignVhf);
            console.log("imo:", jsonContent[jsonKey].registrations.imo);
            console.log("id:", jsonContent[jsonKey].design.aisShipType.value.id);
            console.log("type:", jsonContent[jsonKey].design.aisShipType.value.name);
            console.log("draft_cur:", jsonContent[jsonKey].design.draft.value.current);
//            console.log("draft_max:", jsonContent[jsonKey].design.draft.value.maximum);
            console.log("lenght:", jsonContent[jsonKey].design.length.value.overall);
            console.log("beam:", jsonContent[jsonKey].design.beam.value);

            enc_msg = {
              aistype: 18, // class B position report
              repeat: 0,
              mmsi: jsonContent[jsonKey].mmsi,
              sog: ms_to_knots(jsonContent[jsonKey].navigation.speedOverGround.value),
              accuracy: 0,
              lon: jsonContent[jsonKey].navigation.position.value.longitude,
              lat: jsonContent[jsonKey].navigation.position.value.latitude,
              cog: radians_to_degrees(jsonContent[jsonKey].navigation.courseOverGroundTrue.value),
              hdg: jsonContent[jsonKey].navigation.headingTrue.value,
            }
            var enc = new AisEncode(enc_msg)
            var sentence = enc.nmea
            if ( sentence && sentence.length > 0 )
            {
              console.log("sending: " + sentence)
              //app.emit('nmea0183out', sentence)
            }
            console.log("---- AIS info from: "+ i +" ----");
            console.log("");


          }
            console.log("json size: "+ kB(lengthInUtf8Bytes(myJson))+"kB");
            console.log("Date: "+ date);


        })
        .catch(err => console.error(err));;
}
