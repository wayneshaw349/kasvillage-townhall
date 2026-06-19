const fs = require('fs');
let c = fs.readFileSync('NeighborAgreement.tsx', 'utf8');
// Fix: myPubkey is undefined in render scope — use contract.buyerPubkey instead
const old = "buyerPubkey: myPubkey || '',";
const idx = c.indexOf(old, c.indexOf('Copy All to Clipboard') - 500);
if (idx > -1) {
  c = c.substring(0, idx) + "buyerPubkey: contract.buyerPubkey || ''," + c.substring(idx + old.length);
  console.log('OK: fixed myPubkey reference in clipboard handler');
} else {
  console.log('Not found near Copy All');
}
fs.writeFileSync('NeighborAgreement.tsx', c);
