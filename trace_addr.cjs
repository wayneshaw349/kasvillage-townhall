const https = require("https");
const addr = "kaspatest:qp7592kfylul443ee5950xe7jgv4rkgrv87ju8s96xz0sy3t79cnxmdmtcusz";
const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const dp = addr.split(":")[1] || "";
const d5 = Array.from(dp).map(c => CHARSET.indexOf(c));
const rb = []; let bf=0, bi=0;
for (const d of d5){ bf=(bf<<5)|d; bi+=5; while(bi>=8){ bi-=8; rb.push((bf>>bi)&0xff);} }
const x = rb.slice(1,33).map(b=>b.toString(16).padStart(2,"0")).join("");
function stats(pk){ const body=JSON.stringify({pubkey:pk}); return new Promise(r=>{const q=https.request("https://kasvillage.app.runonflux.io/user-stats",{method:"POST",headers:{"Content-Type":"application/json","Content-Length":Buffer.byteLength(body)}},res=>{let d="";res.on("data",c=>d+=c);res.on("end",()=>r({pk,body:d}));});q.on("error",e=>r({pk,err:String(e)}));q.write(body);q.end();}); }
(async()=>{
  console.log("x-only:", x);
  for (const pfx of ["02","03"]) {
    const res = await stats(pfx+x);
    let p={}; try{p=JSON.parse(res.body);}catch{}
    console.log(pfx, "=> xp:", p.xp, "successes:", p.successes, "total_samples:", p.total_samples, "p_complete:", p.p_complete, "trust:", p.trust);
  }
})();
