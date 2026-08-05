const https = require("https");
const addr = encodeURIComponent("kaspatest:qp7592kfylul443ee5950xe7jgv4rkgrv87ju8s96xz0sy3t79cnxmdmtcusz");
for (const url of [
  "https://api-tn10.kaspa.org/addresses/" + addr + "/utxos",
  "https://api.kaspa.org/addresses/" + addr + "/utxos",
]) {
  https.get(url, r => { let d=""; r.on("data",c=>d+=c); r.on("end",()=>console.log(r.statusCode, url.slice(8,40)+"...", d.slice(0,120))); }).on("error",e=>console.log("ERR",url.slice(8,40),String(e)));
}
