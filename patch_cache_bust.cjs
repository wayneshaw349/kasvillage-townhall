const fs = require('fs');
let c = fs.readFileSync('townhallscreen.tsx', 'utf8');
const old = "const pollRes = await fetch(`${TOWNHALL_BASE}/proof-status/${data.proof_id}`);";
const rep = "const pollRes = await fetch(`${TOWNHALL_BASE}/proof-status/${data.proof_id}?t=${Date.now()}`);";
if (c.includes(old)) { c = c.replace(old, rep); fs.writeFileSync('townhallscreen.tsx', c); console.log('Cache bust: OK'); }
else { console.log('Cache bust: pattern not found'); }
