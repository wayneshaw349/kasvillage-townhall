const fs = require('fs');
let c = fs.readFileSync('NeighborAgreement.tsx', 'utf8');
// Line 3664: replace the specific myPubkey reference
const old = "buyerPubkey: myPubkey || '',";
const copyIdx = c.indexOf("Copy All to Clipboard");
console.log("Copy All at:", copyIdx);
// Find the myPubkey nearest to that area
const allIdx = [];
let s = 0;
while ((s = c.indexOf(old, s)) !== -1) { allIdx.push(s); s += old.length; }
console.log("All myPubkey positions:", allIdx.length);
// Pick the one closest to Copy All
if (copyIdx > -1 && allIdx.length > 0) {
  const nearest = allIdx.reduce((a, b) => Math.abs(b - copyIdx) < Math.abs(a - copyIdx) ? b : a);
  c = c.substring(0, nearest) + "buyerPubkey: contract.buyerPubkey || ''," + c.substring(nearest + old.length);
  console.log("Fixed at position:", nearest);
} else if (allIdx.length > 0) {
  // Fallback: fix the last occurrence (likely the clipboard one)
  const last = allIdx[allIdx.length - 1];
  c = c.substring(0, last) + "buyerPubkey: contract.buyerPubkey || ''," + c.substring(last + old.length);
  console.log("Fixed last occurrence at:", last);
} else {
  console.log("Pattern not found");
}
fs.writeFileSync('NeighborAgreement.tsx', c);
