// wire_attest_pin.cjs - pin the NEW attest public key in the wallet (canary_verify.ts).
//   node wire_attest_pin.cjs <64-hex x-only public key>     (from gen_attest_key.cjs or GET /api/canary/pubkey)
const fs = require('fs');
const pub = String(process.argv[2] || '').trim().toLowerCase();
if (!/^[0-9a-f]{64}$/.test(pub)) { console.log('  FAIL  give the 64-hex PUBLIC key (not the secret)'); process.exit(1); }
const F = 'canary_verify.ts';
const raw = fs.readFileSync(F, 'utf8');
const re = /export const PINNED_ATTEST_PUBKEY: string = '([0-9a-fA-F]*)';/;
const m = raw.match(re);
if (!m) { console.log('  FAIL  pin line not found in ' + F); process.exit(1); }
if (m[1].toLowerCase() === pub) { console.log('  done  already pinned'); process.exit(0); }
fs.writeFileSync(F, raw.replace(re, "export const PINNED_ATTEST_PUBKEY: string = '" + pub + "'; // KV_ATTEST_ROTATED (old key retired)"));
console.log('  ok    pinned ' + pub.slice(0, 12) + '… (was ' + m[1].slice(0, 12) + '…)');
