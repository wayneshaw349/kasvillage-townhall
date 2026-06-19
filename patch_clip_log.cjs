const fs = require('fs');
let c = fs.readFileSync('NeighborAgreement.tsx', 'utf8');
c = c.replace(
  "Clipboard.setStringAsync(shareText);",
  "console.log('[Clipboard] Proposal length:', shareText?.length, 'text:', shareText?.slice(0,80));\n                          Clipboard.setStringAsync(shareText || '');"
);
fs.writeFileSync('NeighborAgreement.tsx', c);
console.log('OK');
