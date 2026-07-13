const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let s = fs.readFileSync(f, 'utf8');
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const norm = str => str.split('\n').join(EOL);

const marker = 'parsed.valid === false';
if (s.includes(marker)) { console.log('SKIP — already applied'); process.exit(0); }

// Insert a reject-branch right where the current success path starts.
const a = norm('                          if (parsed) {\n                            console.log("[Seller-Paste] Parsed KV proposal:", parsed.agrId, parsed.description);');
const b = norm('                          if (parsed && parsed.valid === false) {\n                            console.warn("[Seller-Paste] REJECTED:", parsed.error);\n                            Alert.alert("Proposal Rejected", parsed.error || "Signature invalid \\u2014 do not proceed.");\n                          } else if (parsed) {\n                            console.log("[Seller-Paste] Parsed KV proposal:", parsed.agrId, parsed.description);');

const n = s.split(a).length - 1;
if (n === 1) { s = s.split(a).join(b); fs.writeFileSync(f, s); console.log('WROTE — seller now rejects unsigned/tampered proposals'); }
else { console.log('NO WRITE — found ' + n + ' (expected 1)'); }
