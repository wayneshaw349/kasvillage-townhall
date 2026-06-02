const fs = require('fs');

// ============================================
// PATCH 1: frost_complete.ts — add agreementId to L hash
// ============================================
let fc = fs.readFileSync('frost_complete.ts', 'utf8');

const oldFcL = "const L = sha256(new Uint8Array([...hexToBytes(pk1), ...hexToBytes(pk2), ..._nb]));";
const newFcL = "const _agr = agreementId ? new TextEncoder().encode(agreementId) : new Uint8Array(0);\n  const L = sha256(new Uint8Array([...hexToBytes(pk1), ...hexToBytes(pk2), ..._agr, ..._nb]));";

const fcCount = (fc.match(new RegExp(oldFcL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
if (fcCount === 0) { console.log('frost_complete.ts: L hash pattern not found'); process.exit(1); }
fc = fc.split(oldFcL).join(newFcL);
fs.writeFileSync('frost_complete.ts', fc);
console.log('frost_complete.ts: patched', fcCount, 'L hash(es) with agreementId');

// Also patch generateFrostNonce and createPartialSigLocal which have inline L computation
// They use the same pattern: _L = sha256([pk1, pk2, _fnonce])
const oldNonceL = "const _L = sha256(new Uint8Array([...hexToBytes(_pk1), ...hexToBytes(_pk2), ..._fnonce]));";
let fc2 = fs.readFileSync('frost_complete.ts', 'utf8');
const nonceCount = (fc2.match(new RegExp(oldNonceL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
if (nonceCount > 0) {
  const newNonceL = "const _agrId = frostAddress?.sessionId ? new TextEncoder().encode(frostAddress.sessionId) : new Uint8Array(0);\n  const _L = sha256(new Uint8Array([...hexToBytes(_pk1), ...hexToBytes(_pk2), ..._agrId, ..._fnonce]));";
  fc2 = fc2.split(oldNonceL).join(newNonceL);
  fs.writeFileSync('frost_complete.ts', fc2);
  console.log('frost_complete.ts: patched', nonceCount, 'nonce L hash(es) with sessionId');
}

// ============================================
// PATCH 2: canonical_agreement_steps.ts — add agreementId to computeL
// ============================================
let ca = fs.readFileSync('canonical_agreement_steps.ts', 'utf8');

// Update computeL signature + body
const oldComputeL = "export function computeL(pk1: string, pk2: string, counter?: number): Uint8Array {\n  const counterBytes =\n    counter && counter > 0\n      ? new TextEncoder().encode(String(counter))\n      : new Uint8Array(0);\n  return sha256(\n    new Uint8Array([...hexToBytes(pk1), ...hexToBytes(pk2), ...counterBytes])\n  );\n}";

const newComputeL = "export function computeL(pk1: string, pk2: string, counter?: number, agreementId?: string): Uint8Array {\n  const counterBytes =\n    counter && counter > 0\n      ? new TextEncoder().encode(String(counter))\n      : new Uint8Array(0);\n  const agrBytes = agreementId ? new TextEncoder().encode(agreementId) : new Uint8Array(0);\n  return sha256(\n    new Uint8Array([...hexToBytes(pk1), ...hexToBytes(pk2), ...agrBytes, ...counterBytes])\n  );\n}";

if (!ca.includes(oldComputeL)) { console.log('canonical: computeL pattern not found'); process.exit(1); }
ca = ca.replace(oldComputeL, newComputeL);

// Update deriveAggregateKey to accept + pass agreementId
ca = ca.replace(
  "export function deriveAggregateKey(\n  pubkeyA: string,\n  pubkeyB: string,\n  counter?: number\n)",
  "export function deriveAggregateKey(\n  pubkeyA: string,\n  pubkeyB: string,\n  counter?: number,\n  agreementId?: string\n)"
);
ca = ca.replace(
  "const L = computeL(pk1, pk2, counter);",
  "const L = computeL(pk1, pk2, counter, agreementId);"
);

// Update generateNonce to accept + pass agreementId
ca = ca.replace(
  "export function generateNonce(\n  privateKeyHex: string,\n  pubkeyA: string,\n  pubkeyB: string,\n  counter?: number\n): FrostNonce {",
  "export function generateNonce(\n  privateKeyHex: string,\n  pubkeyA: string,\n  pubkeyB: string,\n  counter?: number,\n  agreementId?: string\n): FrostNonce {"
);
// Fix the L computation in generateNonce
ca = ca.replace(
  "const L = computeL(pk1, pk2, counter);\n  const myPub = bytesToHex(secp256k1.getPublicKey(hexToBytes(privateKeyHex), true));\n  const myCoeff = bindingCoefficient(L, myPub === pk1 ? pk1 : pk2);",
  "const L = computeL(pk1, pk2, counter, agreementId);\n  const myPub = bytesToHex(secp256k1.getPublicKey(hexToBytes(privateKeyHex), true));\n  const myCoeff = bindingCoefficient(L, myPub === pk1 ? pk1 : pk2);"
);
// Fix the deriveAggregateKey call in generateNonce
ca = ca.replace(
  "const agg = deriveAggregateKey(pubkeyA, pubkeyB, counter);\n  const aggBytes = hexToBytes(agg.aggPubkey);\n  if (aggBytes[0] === 0x03) d = mod(N - d, N);",
  "const agg = deriveAggregateKey(pubkeyA, pubkeyB, counter, agreementId);\n  const aggBytes = hexToBytes(agg.aggPubkey);\n  if (aggBytes[0] === 0x03) d = mod(N - d, N);"
);

// Update buyerBuildTemplate to pass agrId through
ca = ca.replace(
  "const nonce = generateNonce(\n    params.privateKeyHex,\n    params.buyerPubkey,\n    params.sellerPubkey,\n    params.counter\n  );",
  "const nonce = generateNonce(\n    params.privateKeyHex,\n    params.buyerPubkey,\n    params.sellerPubkey,\n    params.counter,\n    params.agrId\n  );"
);

// Update sellerSignTemplate to pass agreementId
ca = ca.replace(
  "const agg = deriveAggregateKey(buyerPubkey, sellerPubkey, counter);\n\n  // Generate seller nonce (k born — dies at end of this function)\n  const nonce = generateNonce(privateKeyHex, buyerPubkey, sellerPubkey, counter);",
  "const agrId = template.agr || '';\n  const agg = deriveAggregateKey(buyerPubkey, sellerPubkey, counter, agrId);\n\n  // Generate seller nonce (k born — dies at end of this function)\n  const nonce = generateNonce(privateKeyHex, buyerPubkey, sellerPubkey, counter, agrId);"
);

// Update buyerAggregate to pass agreementId
ca = ca.replace(
  "const agg = deriveAggregateKey(buyerPubkey, sellerPubkey, counter);\n\n  const inputs: CanonicalInput[]",
  "const agrId = template.agr || '';\n  const agg = deriveAggregateKey(buyerPubkey, sellerPubkey, counter, agrId);\n\n  const inputs: CanonicalInput[]"
);

fs.writeFileSync('canonical_agreement_steps.ts', ca);
console.log('canonical_agreement_steps.ts: patched computeL + deriveAggregateKey + generateNonce + ceremonies');
console.log('Verify computeL:', ca.includes('agreementId?: string): Uint8Array'));
console.log('Verify deriveAgg:', ca.includes("counter?: number,\n  agreementId?: string"));
console.log('Verify nonce:', ca.includes("counter, agreementId);\n  const myPub"));
console.log('Verify buyerBuild:', ca.includes("params.counter,\n    params.agrId"));
console.log('Verify sellerSign:', ca.includes("counter, agrId);\n\n  // Generate seller"));
console.log('Verify buyerAgg:', ca.includes("counter, agrId);\n\n  const inputs"));
