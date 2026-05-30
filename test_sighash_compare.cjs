/**
 * Sighash comparison: L1-proven (test_frost_e2e_counter.cjs) vs canonical
 * Run: node test_sighash_compare.cjs
 */
const { sha256 } = require('@noble/hashes/sha256');
const { blake2b } = require('@noble/hashes/blake2b');
const { bytesToHex, hexToBytes } = require('@noble/hashes/utils');

const HASH_KEY = new TextEncoder().encode('TransactionSigningHash');
function kb2b(data) { return blake2b(data, { dkLen: 32, key: HASH_KEY }); }
function concat(...arrs) { const t = arrs.reduce((s,a)=>s+a.length,0); const r = new Uint8Array(t); let o=0; for(const a of arrs){r.set(a,o);o+=a.length;} return r; }
function w8(v){return new Uint8Array([v]);}
function w16(v){const b=new Uint8Array(2);new DataView(b.buffer).setUint16(0,v,true);return b;}
function w32(v){const b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,v,true);return b;}
function w64(v){const b=new Uint8Array(8);const d=new DataView(b.buffer);d.setUint32(0,Number(v&0xFFFFFFFFn),true);d.setUint32(4,Number(v>>32n),true);return b;}

// ===================== L1-PROVEN VERSION (from test_frost_e2e_counter.cjs) =====================
function L1_hashPrevOutputs(inputs){return kb2b(concat(...inputs.map(i=>concat(hexToBytes(i.txId),w32(i.index)))));}
function L1_hashSequences(inputs){return kb2b(concat(...inputs.map(()=>w64(0n))));}
function L1_hashSigOpCounts(inputs){return kb2b(new Uint8Array(inputs.map(()=>1)));}
function L1_hashOutputs(outputs){return kb2b(concat(...outputs.map(o=>concat(w64(o.value),w16(0),w64(BigInt(hexToBytes(o.script).length)),hexToBytes(o.script)))));}

function L1_computeSighash(inputs, outputs, idx) {
  const inp = inputs[idx];
  const spk = hexToBytes(inp.scriptPubKey);
  const subnetId = new Uint8Array(20);
  return kb2b(concat(
    w16(0), L1_hashPrevOutputs(inputs), L1_hashSequences(inputs), L1_hashSigOpCounts(inputs),
    hexToBytes(inp.txId), w32(inp.index), w16(0), w64(BigInt(spk.length)), spk,
    w64(inp.value), w64(0n), w8(1), L1_hashOutputs(outputs),
    w64(0n), subnetId, w64(0n), new Uint8Array(32), w8(1),
  ));
}

// ===================== CANONICAL VERSION (from canonical_agreement_steps.ts) =====================
function CAN_hashPrevOutputs(inputs){return blake2b(concat(...inputs.map(i=>concat(hexToBytes(i.txId),w32(i.index)))),{dkLen:32,key:HASH_KEY});}
function CAN_hashSequences(inputs){return blake2b(concat(...inputs.map(()=>w64(0n))),{dkLen:32,key:HASH_KEY});}
function CAN_hashSigOpCounts(inputs){return blake2b(new Uint8Array(inputs.map(()=>1)),{dkLen:32,key:HASH_KEY});}
function CAN_hashOutputs(outputs){return blake2b(concat(...outputs.map(o=>concat(w64(o.value),w16(0),w64(BigInt(hexToBytes(o.script).length)),hexToBytes(o.script)))),{dkLen:32,key:HASH_KEY});}

function CAN_computeSighash(inputs, outputs, inputIndex) {
  const inp = inputs[inputIndex];
  const spk = hexToBytes(inp.scriptPubKey);
  const subnetId = new Uint8Array(20);
  return blake2b(concat(
    w16(0),
    CAN_hashPrevOutputs(inputs),
    CAN_hashSequences(inputs),
    CAN_hashSigOpCounts(inputs),
    hexToBytes(inp.txId),
    w32(inp.index),
    w16(0),
    w64(BigInt(spk.length)),
    spk,
    w64(inp.value),
    w64(0n),
    w8(1),
    CAN_hashOutputs(outputs),
    w64(0n),
    subnetId,
    w64(0n),
    new Uint8Array(32),
    w8(1)
  ), { dkLen: 32, key: HASH_KEY });
}

// ===================== TEST DATA =====================
const BUYER_PUB = '0335f1be04eb12982f061a268f96d580194f8331084bc13a833633d089fae46f4e';
const SELLER_PUB = '02ed0484ee0a35c2ebab66bab53fb6bce4b7cc5bf8297d802b39d2a4e35be1cc11';
const [pk1, pk2] = [BUYER_PUB, SELLER_PUB].sort();
const L = sha256(new Uint8Array([...hexToBytes(pk1), ...hexToBytes(pk2)]));
const a1 = BigInt('0x' + bytesToHex(sha256(new Uint8Array([...L, ...hexToBytes(pk1)]))));
const a2 = BigInt('0x' + bytesToHex(sha256(new Uint8Array([...L, ...hexToBytes(pk2)]))));
const { secp256k1 } = require('@noble/curves/secp256k1');
const N = secp256k1.CURVE.n;
const P1 = secp256k1.ProjectivePoint.fromHex(pk1);
const P2 = secp256k1.ProjectivePoint.fromHex(pk2);
const Pagg = P1.multiply(a1 % N).add(P2.multiply(a2 % N));
const aggB = Pagg.toRawBytes(true);
const frostScript = '20' + bytesToHex(aggB.slice(1)) + 'ac';

// 2 UTXOs like a real agreement
const utxos = [
  { txId: bytesToHex(sha256(new TextEncoder().encode('buyer_funding_tx'))), index: 0, value: 200000000n, scriptPubKey: frostScript },
  { txId: bytesToHex(sha256(new TextEncoder().encode('seller_funding_tx'))), index: 0, value: 400000000n, scriptPubKey: frostScript },
].sort((a, b) => a.txId.localeCompare(b.txId));

const buyerScript = '20' + BUYER_PUB.slice(2) + 'ac';
const sellerScript = '20' + SELLER_PUB.slice(2) + 'ac';
const totalIn = utxos.reduce((s, u) => s + u.value, 0n);
const fee = 300000n;
const outputs = [
  { value: 200000000n, script: buyerScript },
  { value: totalIn - 200000000n - fee, script: sellerScript },
];

// ===================== RUN =====================
console.log('=== SIGHASH COMPARISON: L1-PROVEN vs CANONICAL ===\n');
console.log('Inputs:', utxos.length);
console.log('Outputs:', outputs.length);
console.log('Fee:', Number(fee)/1e8, 'KAS\n');

let allMatch = true;

for (let i = 0; i < utxos.length; i++) {
  const l1 = bytesToHex(L1_computeSighash(utxos, outputs, i));
  const can = bytesToHex(CAN_computeSighash(utxos, outputs, i));
  const match = l1 === can;
  if (!match) allMatch = false;

  console.log(`Input ${i}:`);
  console.log(`  L1-proven:  ${l1}`);
  console.log(`  Canonical:  ${can}`);
  console.log(`  Match: ${match ? 'YES' : 'NO <<<< MISMATCH'}`);
}

// Also test sub-hashes
console.log('\n--- Sub-hash comparison ---');
const tests = [
  ['hashPrevOutputs', L1_hashPrevOutputs(utxos), CAN_hashPrevOutputs(utxos)],
  ['hashSequences', L1_hashSequences(utxos), CAN_hashSequences(utxos)],
  ['hashSigOpCounts', L1_hashSigOpCounts(utxos), CAN_hashSigOpCounts(utxos)],
  ['hashOutputs', L1_hashOutputs(outputs), CAN_hashOutputs(outputs)],
];
for (const [name, l1, can] of tests) {
  const match = bytesToHex(l1) === bytesToHex(can);
  console.log(`  ${name}: ${match ? 'MATCH' : 'MISMATCH <<<'}`);
  if (!match) allMatch = false;
}

console.log(`\n${'='.repeat(50)}`);
console.log(allMatch ? '  ALL SIGHASHES IDENTICAL' : '  MISMATCH DETECTED — DO NOT USE CANONICAL');
console.log(`${'='.repeat(50)}`);
process.exit(allMatch ? 0 : 1);
