const fs = require('fs');

// === 1. NeighborAgreement.tsx — all remaining hardcoded 02 ===
let na = fs.readFileSync('NeighborAgreement.tsx', 'utf8');
let naCount = 0;

// L1865: const pubkey = '02' + xOnly.map((b: number)...
const t1 = "const pubkey = '02' + xOnly.map((b: number) => b.toString(16).padStart(2, '0')).join('');";
const r1 = "const pubkey = (await SecureStore.getItemAsync('kv_public_key')) || ('02' + xOnly.map((b: number) => b.toString(16).padStart(2, '0')).join(''));";
while (na.includes(t1)) { na = na.replace(t1, r1); naCount++; }

// L1897: const pubkeyHex = '02' + xOnly.map(b =>...
const t2 = "const pubkeyHex = '02' + xOnly.map(b => b.toString(16).padStart(2, '0')).join('');";
const r2 = "const pubkeyHex = (await SecureStore.getItemAsync('kv_public_key')) || ('02' + xOnly.map(b => b.toString(16).padStart(2, '0')).join(''));";
while (na.includes(t2)) { na = na.replace(t2, r2); naCount++; }

// L1334: const myPk = '02' + wallet.address.split(':')[1].slice(0,64);
const t3 = "const myPk = '02' + wallet.address.split(':')[1].slice(0,64);";
const r3 = "const myPk = (await SecureStore.getItemAsync('kv_public_key')) || ('02' + wallet.address.split(':')[1].slice(0,64));";
while (na.includes(t3)) { na = na.replace(t3, r3); naCount++; }

// L2166,2230: _rMyPk ternary
const t4 = "? '02' + _rRb.slice(1, 33).map((b) => b.toString(16).padStart(2, '0')).join('')";
const r4 = "? ((await SecureStore.getItemAsync('kv_public_key')) || ('02' + _rRb.slice(1, 33).map((b) => b.toString(16).padStart(2, '0')).join('')))";
while (na.includes(t4)) { na = na.replace(t4, r4); naCount++; }

// L2820,2943,3032: myPk = rb pattern
const t5 = "? '02' + rb.slice(1, 33).map(b => b.toString(16).padStart(2, '0')).join('')";
const r5 = "? ((await SecureStore.getItemAsync('kv_public_key')) || ('02' + rb.slice(1, 33).map(b => b.toString(16).padStart(2, '0')).join('')))";
while (na.includes(t5)) { na = na.replace(t5, r5); naCount++; }

const t5b = "? '02' + rb.slice(1, 33).map((b) => b.toString(16).padStart(2, '0')).join('')";
const r5b = "? ((await SecureStore.getItemAsync('kv_public_key')) || ('02' + rb.slice(1, 33).map((b) => b.toString(16).padStart(2, '0')).join('')))";
while (na.includes(t5b)) { na = na.replace(t5b, r5b); naCount++; }

fs.writeFileSync('NeighborAgreement.tsx', na);
console.log('NeighborAgreement.tsx:', naCount, 'fixed');

// === 2. Dashboard.tsx ===
let db = fs.readFileSync('Dashboard.tsx', 'utf8');
const dt1 = "resolvedPubkey = '02' + xOnly;";
const dr1 = "resolvedPubkey = (await SecureStore.getItemAsync('kv_public_key')) || ('02' + xOnly);";
if (db.includes(dt1)) { db = db.replace(dt1, dr1); console.log('Dashboard.tsx: 1 fixed'); }
// Check SecureStore import
if (!db.includes("import * as SecureStore")) {
  db = db.replace("import AsyncStorage", "import * as SecureStore from 'expo-secure-store';\nimport AsyncStorage");
  console.log('Dashboard.tsx: added SecureStore import');
}
fs.writeFileSync('Dashboard.tsx', db);

// === 3. kv_proposal.ts ===
let kv = fs.readFileSync('kv_proposal.ts', 'utf8');
const kt1 = "return '02' + xOnly.map(b => b.toString(16).padStart(2, '0')).join('');";
const kr1 = "return '02' + xOnly.map(b => b.toString(16).padStart(2, '0')).join(''); // Fallback: address doesn't preserve parity";
// kv_proposal can't use SecureStore (sync function) — leave as-is but the proposal now carries actual pubkey
if (kv.includes(kt1)) { console.log('kv_proposal.ts: addressToPubkey left as fallback (proposal carries actual pubkey now)'); }

console.log('Done. Verify with: Select-String -Path "NeighborAgreement.tsx" -Pattern "= .02. \\+ xOnly|= .02. \\+ rb|= .02. \\+ wallet"');
