const s = require("fs").readFileSync("proposal_share.ts","utf8").split(/\r?\n/);
s.forEach((l,k)=>{ if(/kv_l1_privkey_enc|decrypt|device_encryption_key|privkey|kv_private_key/.test(l)) console.log((k+1)+": "+l.trim().slice(0,140)); });
