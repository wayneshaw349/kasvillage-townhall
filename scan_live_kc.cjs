const s = require("fs").readFileSync("KaspaClient.ts","utf8").split(/\r?\n/);
s.forEach((l,k)=>{ if(/api-tn10|api\.kaspa|fetch\(|\/utxos|\/addresses\/|REST_BASE|baseUrl|getUtxos/.test(l)) console.log((k+1)+": "+l.trim().slice(0,150)); });
