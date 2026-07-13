const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let s = fs.readFileSync(f, 'utf8');

const edits = [
  // 1) Seed frostData from the paste-derived canonical address.
  //    Then buyerCounter is undefined -> the existing `else if (frostData)`
  //    branch runs -> L1 counter scan is skipped. Address = canon = qppw56 = buyer's.
  ['let frostData: any = null;',
   'let frostData: any = canon.frostData || null; /* PASTE-ONLY: use canon address, skip L1 scan */'],

  // 2) Don't let the Arweave "reuse" block overwrite the canon address.
  ['if (agrFrostAddr && agrFrostAddr.length > 20) {',
   'if (!frostData && agrFrostAddr && agrFrostAddr.length > 20) {'],
];

let ok = true, log = [];
for (const [a, b] of edits) {
  const n = s.split(a).length - 1;
  if (n === 1) { s = s.split(a).join(b); log.push('OK   ' + a.slice(0, 44)); }
  else { ok = false; log.push('MISS(' + n + ') ' + a.slice(0, 44)); }
}

if (ok) { fs.writeFileSync(f, s); console.log('WROTE FILE'); }
else { console.log('NO WRITE — count off (need the comment-anchored variant):'); }
log.forEach(l => console.log('  ' + l));
