// fix_mypubkey_names.cjs
// Corrects the previous fix: use existing aliases h2b/b2h, and ensure secp is imported.
const fs = require('fs');
let n = fs.readFileSync('NeighborAgreement.tsx', 'utf8');

// 1. swap bytesToHex/hexToBytes -> b2h/h2b + secp namespace in the two fixed lines
n = n.replace(/bytesToHex\(secp\.getPublicKey\(hexToBytes\(wallet\.privKeyHex\), true\)\)/g,
              'b2h(secpPub(wallet.privKeyHex))');

// 2. add a tiny helper + secp import if missing
if (!n.includes('function secpPub(')) {
  // find the noble utils import line and inject after it
  const importLine = "import { hexToBytes as h2b, bytesToHex as b2h } from '@noble/hashes/utils';";
  if (n.indexOf(importLine) < 0) { console.log('IMPORT ANCHOR FAIL'); process.exit(1); }
  const inject = importLine +
    "\nimport * as _secpNA from '@noble/secp256k1';" +
    "\nfunction secpPub(privHex: string): Uint8Array { return (_secpNA as any).getPublicKey(h2b(privHex), true); }";
  n = n.replace(importLine, inject);
}

fs.writeFileSync('NeighborAgreement.tsx', n);
console.log('OK');
