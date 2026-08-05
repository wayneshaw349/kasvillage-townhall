const s = require("fs").readFileSync("IOUBalanceSheetShare.tsx","utf8").split(/\r?\n/);
const i = s.findIndex(l => l.includes("getWalletCredentials"));
console.log("=== getWalletCredentials @ " + (i+1) + " ===");
for (let j = i; j < i + 35 && j < s.length; j++) console.log((j+1)+": "+JSON.stringify(s[j]?.slice(0,140)));
console.log("=== privkey / decrypt / sign references ===");
s.forEach((l,k)=>{ if(/PRIVKEY_ENC|privkey|hexToBytes.*priv|decrypt|signIOU|secp256k1.sign/.test(l)) console.log((k+1)+": "+l.trim().slice(0,130)); });
