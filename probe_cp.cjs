const https=require("https");
const pk="037d42aac927f9fad639cd0b479b3e921951d90361fd2e1e05d184f8122bf17133";
https.get("https://kasvillage.app.runonflux.io/api/counterparty/"+pk, r=>{let d="";r.on("data",c=>d+=c);r.on("end",()=>console.log("code:",r.statusCode,"\n",d.slice(0,300)));}).on("error",e=>console.log("ERR",String(e)));
