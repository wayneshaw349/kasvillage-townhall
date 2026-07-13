// addcounterdebug.cjs
const fs = require('fs');
let n = fs.readFileSync('NeighborAgreement.tsx', 'utf8');

const decl = "const buyerCounter = (agreement as any)?.frostCounter ?? (agreement as any)?.KVFrostCounter;";
if (n.indexOf(decl) < 0) { console.log('DECL ANCHOR FAIL'); process.exit(1); }

const nw =
"const buyerCounter = (agreement as any)?.frostCounter ?? (agreement as any)?.KVFrostCounter ?? (agreement as any)?.['KV-FrostCounter'];\n" +
"          console.log('[Seller-Counter-DEBUG] buyerCounter=', buyerCounter, 'agrKeys=', Object.keys(agreement || {}).join(','));";

n = n.replace(decl, nw);
fs.writeFileSync('NeighborAgreement.tsx', n);
console.log('OK');
