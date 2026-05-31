const fs = require('fs');
let f = fs.readFileSync('NeighborAgreement.tsx', 'utf8');

// Find "utxoTag" in the AGR hash input — handle both LF and CRLF
const idx = f.indexOf('utxoTag\n\n\n');
const idx2 = f.indexOf('utxoTag\r\n\r\n\r\n');
const idx3 = f.indexOf('utxoTag\n\n');
const idx4 = f.indexOf("utxoTag +\n");

// Find whichever pattern exists
let insertAfter = -1;
let searchStr = '';

if (idx4 >= 0) {
  console.log('Already patched (utxoTag +)');
  process.exit(0);
}

if (idx >= 0) { insertAfter = idx + 'utxoTag'.length; searchStr = 'LF'; }
else if (idx2 >= 0) { insertAfter = idx2 + 'utxoTag'.length; searchStr = 'CRLF'; }
else if (idx3 >= 0) { insertAfter = idx3 + 'utxoTag'.length; searchStr = 'LF2'; }
else {
  // Brute force: find the line containing just "utxoTag" near the AGR hash
  const lines = f.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === 'utxoTag' && i > 1690 && i < 1710) {
      lines[i] = lines[i].replace('utxoTag', "utxoTag +\n            (contract.itemDescription || '') +\n            String(Date.now())");
      f = lines.join('\n');
      fs.writeFileSync('NeighborAgreement.tsx', f);
      console.log('Added via line replace at line', i + 1);
      console.log('Emojis:', (f.match(/[\u{1F000}-\u{1FFFF}]/gu) || []).length);
      process.exit(0);
    }
  }
  console.log('utxoTag not found in AGR hash area');
  process.exit(1);
}

// Insert after utxoTag
f = f.slice(0, insertAfter) + " +\n            (contract.itemDescription || '') +\n            String(Date.now())" + f.slice(insertAfter);

fs.writeFileSync('NeighborAgreement.tsx', f);
console.log('AGR hash now includes description + Date.now() (' + searchStr + ')');
console.log('Emojis:', (f.match(/[\u{1F000}-\u{1FFFF}]/gu) || []).length);
