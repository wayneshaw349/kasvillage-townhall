// fix_mypubkey_prefix.cjs
// Root cause: myPubkey built from schnorr x-only key + hardcoded '02' prefix.
// Odd-y keys (03..) get mislabeled as 02.. -> wrong pubkey -> sort divergence,
// FROST address divergence, role mismatch.
// Fix: derive the FULL compressed pubkey with its real prefix via secp.getPublicKey(priv, true).
const fs = require('fs');
let n = fs.readFileSync('NeighborAgreement.tsx', 'utf8');

if (n.includes('// [PUBKEY-PREFIX-FIX]')) { console.log('already applied'); process.exit(0); }

let count = 0;

// Pattern 1: line ~1170  '02' + xOnly.map(...)
const re1 = /myPubkey = \(await SecureStore\.getItemAsync\('kv_public_key'\)\) \|\| \('02' \+ xOnly\.map\(\(b: number\) => b\.toString\(16\)[^\n]*\);/;
if (re1.test(n)) {
  n = n.replace(re1,
    "myPubkey = (await SecureStore.getItemAsync('kv_public_key')) || bytesToHex(secp.getPublicKey(hexToBytes(wallet.privKeyHex), true)); // [PUBKEY-PREFIX-FIX] real compressed prefix");
  count++;
}

// Pattern 2: line ~1343  '02' + wallet.address.split(':')[1].slice(...)
const re2 = /const myPk = \(await SecureStore\.getItemAsync\('kv_public_key'\)\) \|\| \('02' \+ wallet\.address\.split\(':'\)\[1\]\.slice[^\n]*\);/;
if (re2.test(n)) {
  n = n.replace(re2,
    "const myPk = (await SecureStore.getItemAsync('kv_public_key')) || bytesToHex(secp.getPublicKey(hexToBytes(wallet.privKeyHex), true)); // [PUBKEY-PREFIX-FIX] real compressed prefix");
  count++;
}

if (count === 0) { console.log('NO ANCHOR MATCHED - paste lines 1168-1172 and 1341-1345'); process.exit(1); }
fs.writeFileSync('NeighborAgreement.tsx', n);
console.log('OK - replaced', count, 'hardcoded 02 pubkey construction(s)');
