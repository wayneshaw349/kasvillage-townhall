const https=require("https");
const pk="037d42aac927f9fad639cd0b479b3e921951d90361fd2e1e05d184f8122bf17133";
const body=JSON.stringify({pubkey:pk});
const req=https.request("https://kasvillage.app.runonflux.io/user-stats",{method:"POST",headers:{"Content-Type":"application/json","Content-Length":Buffer.byteLength(body)}},r=>{let d="";r.on("data",c=>d+=c);r.on("end",()=>console.log(d));});
req.on("error",e=>console.log("ERR",String(e)));req.write(body);req.end();
