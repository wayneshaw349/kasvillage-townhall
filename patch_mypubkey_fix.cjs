const fs = require('fs');
let c = fs.readFileSync('NeighborAgreement.tsx', 'utf8');

// Replace BOTH hardcoded '02' prefix derivations with SecureStore read
// First occurrence (L1158-1161)
let count = 0;
c = c.replace(
  /let myPubkey = '';\s*(?:.*\n)*?.*myPubkey = '02' \+ xOnly\.map\(\(b: number\) => b\.toString\(16\)\.padStart\(2, '0'\)\)\.join\(''\);/g,
  (match) => {
    count++;
    return "let myPubkey = await SecureStore.getItemAsync('kv_public_key') || '';";
  }
);

console.log('Replaced', count, 'occurrences');
fs.writeFileSync('NeighborAgreement.tsx', c);
