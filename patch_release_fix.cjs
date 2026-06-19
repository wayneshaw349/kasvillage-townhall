const fs = require('fs');
let c = fs.readFileSync('NeighborAgreement.tsx', 'utf8');
// Find the actual indentation in the file
const idx = c.indexOf("buyerAmountSompi: BigInt(Math.floor(contract.itemPriceKas * 1e8)),");
if (idx < 0) { console.log('SKIP - buyerAmountSompi line not found'); process.exit(); }
const lineEnd = c.indexOf('\n', idx);
const nextLine = c.substring(lineEnd + 1, c.indexOf('\n', lineEnd + 1));
console.log('Next line after buyerAmountSompi:', JSON.stringify(nextLine.trim()));
// Check if already patched
if (c.includes('releaseMode: releaseMode,')) {
  console.log('Already patched');
} else {
  // Insert after buyerAmountSompi line
  const insertPoint = c.indexOf('\n', idx) + 1;
  const indent = nextLine.match(/^(\s*)/)[1];
  c = c.substring(0, insertPoint) + indent + 'sellerAmountSompi: BigInt(Math.floor(contract.sellerCommitmentKas * 1e8)),\n' + indent + 'releaseMode: releaseMode,\n' + c.substring(insertPoint);
  console.log('Inserted sellerAmountSompi + releaseMode');
}
fs.writeFileSync('NeighborAgreement.tsx', c);
