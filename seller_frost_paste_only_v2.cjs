const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let s = fs.readFileSync(f, 'utf8');

const edits = [
  // 1) Anchored on the comment that precedes the seller's declaration (unique).
  ['// Seller L1 loop: same algorithm as buyer, no relay dependency\n          let frostData: any = null;',
   '// Seller L1 loop: same algorithm as buyer, no relay dependency\n          let frostData: any = canon.frostData || null; /* PASTE-ONLY: use canon address, skip L1 scan */'],

  // 2) Don't let the Arweave reuse block overwrite the canon address (idempotent if already applied).
  ['if (agrFrostAddr && agrFrostAddr.length > 20) {',
   'if (!frostData && agrFrostAddr && agrFrostAddr.length > 20) {'],
];

let ok = true, log = [];
for (const [a, b] of edits) {
  const already = s.split(b).length - 1;
  const n = s.split(a).length - 1;
  if (n === 1) { s = s.split(a).join(b); log.push('OK    ' + a.slice(-46)); }
  else if (n === 0 && already >= 1) { log.push('SKIP  already applied: ' + a.slice(-40)); }
  else { ok = false; log.push('MISS(' + n + ') ' + a.slice(-46)); }
}

if (ok) { fs.writeFileSync(f, s); console.log('WROTE FILE'); }
else { console.log('NO WRITE — count off:'); }
log.forEach(l => console.log('  ' + l));
