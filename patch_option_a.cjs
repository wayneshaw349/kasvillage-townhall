const fs = require('fs');
const f = 'wallet_registration_v2.ts';
let s = fs.readFileSync(f, 'utf8');
const old = "if (options?.identityHashHex) {";
const neu = "if (false && options?.identityHashHex) { // SECURITY: brainwallet path disabled - all wallets use random entropy (Option A)";
const count = s.split(old).length - 1;
if (count !== 1) { console.error('ABORT: anchor found ' + count + 'x, expected 1'); process.exit(1); }
s = s.replace(old, neu);
fs.writeFileSync(f, s);
if (!s.includes("if (false && options?.identityHashHex)")) { console.error('ABORT: post-check failed'); process.exit(1); }
console.log('OK: deterministic branch disabled');
