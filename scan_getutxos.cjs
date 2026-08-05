const s = require("fs").readFileSync("KaspaClient.ts","utf8").split(/\r?\n/);
console.log("=== getUtxos 311-330 ===");
for (let j=310; j<330; j++) console.log((j+1)+": "+JSON.stringify(s[j]?.slice(0,160)));
console.log("=== network field + apiBase pattern 1115-1125 ===");
for (let j=1114; j<1126; j++) console.log((j+1)+": "+JSON.stringify(s[j]?.slice(0,160)));
console.log("=== UtxoEntry type ===");
s.forEach((l,k)=>{ if(/interface UtxoEntry|type UtxoEntry/.test(l)) { for(let j=k;j<k+12;j++) console.log((j+1)+": "+JSON.stringify(s[j]?.slice(0,120))); } });
