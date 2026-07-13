const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let s = fs.readFileSync(f, 'utf8');

// The buyer scan loop uses `_n`; seller/reuse loops use `_sc`/`_rc`, so this is unique.
const a = 'for (let _n = 0; _n < 25; _n++) {';
const b = 'for (let _n = 0; _n < 1; _n++) { // PASTE-ONLY: pin buyer to counter-0 (qppw56), no scan-away';

if (s.includes(b)) { console.log('SKIP — already applied'); process.exit(0); }
const n = s.split(a).length - 1;
if (n === 1) { s = s.split(a).join(b); fs.writeFileSync(f, s); console.log('WROTE — buyer loop capped to counter-0 (falls through to deterministic qppw56)'); }
else { console.log('NO WRITE — found ' + n + ' occurrences of the _n loop (expected 1)'); }
