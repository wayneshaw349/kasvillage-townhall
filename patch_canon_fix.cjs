const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let s = fs.readFileSync(f, 'utf8');

const anchor = "const canon = canonicalVerify(normalized, myPubkey || '');";
const idx = s.indexOf(anchor);
if (idx < 0) { console.log('Anchor not found'); process.exit(1); }

if (s.includes('Canonical-Fix')) { console.log('Already applied'); process.exit(0); }

const fix = `
      // FIX: canonicalVerify returns negative seller when total=0; override from Arweave tags
      if (canon.sellerAmountSompi <= 0 && normalized.sellerAmountSompi > 0) {
        canon.sellerAmountSompi = normalized.sellerAmountSompi;
        canon.buyerAmountSompi = normalized.buyerAmountSompi;
        canon.totalAmountSompi = normalized.buyerAmountSompi + normalized.sellerAmountSompi;
        console.log('[Canonical-Fix] Overrode negative amounts from Arweave tags: buyer=' + canon.buyerAmountSompi + ' seller=' + canon.sellerAmountSompi);
      }`;

const insertAt = s.indexOf('\n', idx) + 1;
s = s.slice(0, insertAt) + fix + '\n' + s.slice(insertAt);
fs.writeFileSync(f, s);
console.log('Fixed:', s.includes('Canonical-Fix'));
