const fs = require('fs');
const path = 'NeighborAgreement.tsx';
let src = fs.readFileSync(path, 'utf8');
const re = /const res2 = await completeFrostAndBroadcast\(\{[\s\S]*?\}\)\(\),[\r\n\s]*\}\);/;
const matches = src.match(new RegExp(re.source, 'g'));
const n = matches ? matches.length : 0;
if (n !== 1) { console.error('[Patch A] ABORT - expected 1 match, found ' + n); process.exit(1); }
const replacement = 'const res2 = { success: false } as any; // DISABLED: completeFrostAndBroadcast (dead single-round path)';
const out = src.replace(re, replacement);
if (out === src) { console.error('[Patch A] ABORT - no change'); process.exit(1); }
if (out.indexOf('await completeFrostAndBroadcast(') !== -1) { console.error('[Patch A] ABORT - call still remains'); process.exit(1); }
if (out.indexOf(replacement) === -1) { console.error('[Patch A] ABORT - replacement missing'); process.exit(1); }
fs.writeFileSync(path, out, 'utf8');
console.log('[Patch A] OK - neutered res2 call. 1 block replaced.');