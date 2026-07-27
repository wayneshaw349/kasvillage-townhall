// find_titles_v3.cjs — locate the amber/purple box titles however they're written
// Run: node find_titles_v3.cjs
const s = require('fs').readFileSync('NeighborAgreement.tsx', 'utf8').split(/\r?\n/);
s.forEach((l, n) => {
  if (/Refund Template|Refund Sign|Seller.{0,3}s Refund|Buyer.{0,3}s Refund/.test(l)) {
    console.log((n + 1) + ': [' + l.trim().slice(0, 150) + ']');
    const i = l.search(/Paste|BUYER|SELLER/);
    if (i >= 0) console.log('   HEX: ' + Buffer.from(l.slice(i, i + 50), 'utf8').toString('hex'));
  }
});
