const fs = require('fs');
const f = 'wallet_registration_v2.ts';
let s = fs.readFileSync(f, 'utf8');
const o1 = "const derived = await deriveWalletFromIdentityHash(options.identityHashHex);";
const n1 = "const derived = await deriveWalletFromIdentityHash(options!.identityHashHex!);";
const o2 = "const seedBytes = sha256(hexToBytes(options.identityHashHex));";
const n2 = "const seedBytes = sha256(hexToBytes(options!.identityHashHex!));";
if (s.split(o1).length - 1 !== 1 || s.split(o2).length - 1 !== 1) { console.error('ABORT: anchors'); process.exit(1); }
s = s.replace(o1, n1).replace(o2, n2);
fs.writeFileSync(f, s);
console.log('OK: non-null assertions added to dead branch');
