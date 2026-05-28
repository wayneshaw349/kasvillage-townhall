// ============================================================================
// KASPA REST API TRANSACTION — with KIP-9 storage mass + fee calculation
// ============================================================================
// Sighash: https://kaspa-mdbook.aspectron.com/transactions/sighashes.html
// Mass: https://kaspa-mdbook.aspectron.com/transactions/constraints/mass.html
// KIP-9: https://github.com/kaspanet/kips/blob/master/kip-0009.md
// Fees: https://kaspa-mdbook.aspectron.com/transactions/constraints/fees.html
// Dust: https://kaspa-mdbook.aspectron.com/transactions/constraints/dust.html
// ============================================================================

// Polyfill crypto.getRandomValues for Hermes (React Native)
import { uploadPerTxProof } from './wallet_merkle_archive';
import { uploadToIrys } from './arweave_upload';
import * as ExpoCrypto from 'expo-crypto';
if (typeof globalThis.crypto === 'undefined') {
  (globalThis as any).crypto = {};
}
if (typeof globalThis.crypto.getRandomValues === 'undefined') {
  (globalThis.crypto as any).getRandomValues = (buffer: Uint8Array) => {
    const bytes = ExpoCrypto.getRandomBytes(buffer.length);
    buffer.set(bytes);
    return buffer;
  };
}

import { schnorr, secp256k1 } from '@noble/curves/secp256k1';
import { blake2b } from '@noble/hashes/blake2b';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

export type KaspaNetwork = 'mainnet' | 'testnet-10' | 'testnet-11';

const API_BASES: Record<KaspaNetwork, string> = {
  'mainnet': 'https://api.kaspa.org',
  'testnet-10': 'https://api-tn10.kaspa.org',
  'testnet-11': 'https://api-tn11.kaspa.org',
};

// ============================================================================
// CONSTANTS
// ============================================================================
const SUBNETWORK_ID_NATIVE = '0000000000000000000000000000000000000000';
const HASH_KEY = new TextEncoder().encode('TransactionSigningHash');
const SIG_HASH_ALL = 0x01;
const MASS_PER_TX_BYTE = 1n;
const MASS_PER_SCRIPT_PUB_KEY_BYTE = 10n;
const MASS_PER_SIG_OP = 1000n;
const MAXIMUM_STANDARD_TX_MASS = 100_000n;
const MINIMUM_RELAY_TX_FEE = 1000n; // sompi per 1000 grams
const HASH_SIZE = 32;
const SUBNETWORK_ID_SIZE = 20;

// ============================================================================
// TYPES
// ============================================================================
export interface RestTxResult {
  success: boolean; txId?: string; explorerUrl?: string; error?: string;
}

interface UtxoResponse {
  address: string;
  outpoint: { transactionId: string; index: number };
  utxoEntry: { amount: string; scriptPublicKey: { scriptPublicKey: string }; blockDaaScore: string; isCoinbase: boolean };
}

// ============================================================================
// HELPERS
// ============================================================================
function writeU16LE(n: number): Uint8Array { return new Uint8Array([n & 0xff, (n >> 8) & 0xff]); }
function writeU32LE(n: number): Uint8Array { return new Uint8Array([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]); }
function writeU64LE(n: bigint): Uint8Array {
  const buf = new Uint8Array(8); let v = n;
  for (let i = 0; i < 8; i++) { buf[i] = Number(v & 0xFFn); v >>= 8n; }
  return buf;
}
function writeU8(n: number): Uint8Array { return new Uint8Array([n]); }
function concat(...arrays: Uint8Array[]): Uint8Array {
  let len = 0; for (const a of arrays) len += a.length;
  const r = new Uint8Array(len); let off = 0;
  for (const a of arrays) { r.set(a, off); off += a.length; }
  return r;
}
function hashBlake2b(data: Uint8Array): Uint8Array {
  return blake2b(data, { dkLen: 32, key: HASH_KEY } as any);
}

// ============================================================================
// TX SIZE ESTIMATION (from rusty-kaspa)
// ============================================================================
function estimateTxSize(inputCount: number, outputScriptLengths: number[], sigScriptLen: number, payloadLen: number): bigint {
  let size = 0n;
  size += 2n; // tx version
  size += 8n; // input count
  for (let i = 0; i < inputCount; i++) {
    size += 36n; // outpoint (32 txid + 4 index)
    size += 8n;  // sig script length field
    size += BigInt(sigScriptLen); // signature script
    size += 8n;  // sequence
  }
  size += 8n; // output count
  for (const scriptLen of outputScriptLengths) {
    size += 8n;  // value
    size += 2n;  // script version
    size += 8n;  // script length field
    size += BigInt(scriptLen); // script
  }
  size += 8n;  // locktime
  size += BigInt(SUBNETWORK_ID_SIZE); // subnetwork
  size += 8n;  // gas
  size += BigInt(HASH_SIZE); // payload hash
  size += 8n;  // payload length field
  size += BigInt(payloadLen); // payload
  return size;
}

// ============================================================================
// COMPUTE MASS
// ============================================================================
function computeMass(inputCount: number, outputScripts: Uint8Array[], sigScriptLen: number, payloadLen: number): bigint {
  const txSize = estimateTxSize(inputCount, outputScripts.map(s => s.length), sigScriptLen, payloadLen);
  const massForSize = txSize * MASS_PER_TX_BYTE;
  
  let totalScriptPubKeySize = 0n;
  for (const s of outputScripts) totalScriptPubKeySize += 2n + BigInt(s.length); // version(u16) + script
  const scriptMass = totalScriptPubKeySize * MASS_PER_SCRIPT_PUB_KEY_BYTE;
  
  const sigOpsMass = BigInt(inputCount) * MASS_PER_SIG_OP;
  
  return massForSize + scriptMass + sigOpsMass;
}

// ============================================================================
// KIP-9 STORAGE MASS
// ============================================================================
function storageMass(inputValues: bigint[], outputValues: bigint[]): bigint {
  // KIP-9 harmonic formula:
  // storage_mass = C * (|O| * sum(1/v_i for inputs) - sum(1/v_j for outputs))
  // where C = 10^12 (1 KAS = 10^8 sompi, C chosen to make mass ~1 for 1 KAS outputs)
  // Simplified: if result < 0, storage_mass = 0
  
  const C = 10_000_000_000n; // 10^10 (adjusted constant for sompi)
  
  if (inputValues.length === 0 || outputValues.length === 0) return 0n;
  
  // Harmonic mean approach: sum of inverses
  // Use integer math: 1/v ≈ C/v
  let inputInverseSum = 0n;
  for (const v of inputValues) {
    if (v === 0n) continue;
    inputInverseSum += C / v;
  }
  
  let outputInverseSum = 0n;
  for (const v of outputValues) {
    if (v === 0n) return MAXIMUM_STANDARD_TX_MASS; // zero-value output = max mass
    outputInverseSum += C / v;
  }
  
  // storage_mass = |outputs| * inputInverseSum - outputInverseSum
  // This penalizes fan-out (many small outputs from few large inputs)
  const numOutputs = BigInt(outputValues.length);
  const mass = numOutputs * inputInverseSum;
  
  if (mass <= outputInverseSum) return 0n;
  return mass - outputInverseSum;
}

// ============================================================================
// DUST CHECK
// ============================================================================
function isDust(valueSompi: bigint, scriptLen: number): boolean {
  // (value * 1000) / (3 * output_serialized_size) < MINIMUM_RELAY_TX_FEE
  const outputSize = 8n + 2n + 8n + BigInt(scriptLen); // value + version + length + script
  return (valueSompi * 1000n) / (3n * outputSize) < MINIMUM_RELAY_TX_FEE;
}

// ============================================================================
// FEE CALCULATION
// ============================================================================
function calculateMinFee(totalMass: bigint): bigint {
  let fee = (totalMass * MINIMUM_RELAY_TX_FEE) / 1000n;
  if (fee === 0n) fee = MINIMUM_RELAY_TX_FEE;
  return fee;
}

async function fetchFeeEstimate(network: KaspaNetwork): Promise<bigint> {
  try {
    const resp = await fetch(`${API_BASES[network]}/info/fee-estimate`);
    if (resp.ok) {
      const data = await resp.json();
      // Returns priority buckets — use normal priority
      const normalFee = data?.normalBuckets?.[0]?.feerate || data?.priorityBucket?.feerate || 1;
      return BigInt(Math.ceil(normalFee));
    }
  } catch {}
  return 1n; // Default: 1 sompi/gram
}

// ============================================================================
// SIGHASH (BIP-143-like for Kaspa)
// ============================================================================
function hashPrevOutputs(inputs: { txId: Uint8Array; index: number }[]): Uint8Array {
  const parts: Uint8Array[] = [];
  for (const inp of inputs) { parts.push(inp.txId); parts.push(writeU32LE(inp.index)); }
  return hashBlake2b(concat(...parts));
}
function hashSequences(inputs: { sequence: bigint }[]): Uint8Array {
  const parts: Uint8Array[] = [];
  for (const inp of inputs) parts.push(writeU64LE(inp.sequence));
  return hashBlake2b(concat(...parts));
}
function hashSigOpCounts(inputs: { sigOpCount: number }[]): Uint8Array {
  const buf = new Uint8Array(inputs.length);
  for (let i = 0; i < inputs.length; i++) buf[i] = inputs[i].sigOpCount;
  return hashBlake2b(buf);
}
function hashOutputs(outputs: { value: bigint; scriptVersion: number; script: Uint8Array }[]): Uint8Array {
  const parts: Uint8Array[] = [];
  for (const out of outputs) {
    parts.push(writeU64LE(out.value));
    parts.push(writeU16LE(out.scriptVersion));
    parts.push(writeU64LE(BigInt(out.script.length)));
    parts.push(out.script);
  }
  return hashBlake2b(concat(...parts));
}

export function computeSighash(
  txVersion: number,
  inputs: { txId: Uint8Array; index: number; sequence: bigint; sigOpCount: number; scriptVersion: number; scriptPubKey: Uint8Array; value: bigint }[],
  outputs: { value: bigint; scriptVersion: number; script: Uint8Array }[],
  inputIndex: number,
  subnetworkId: Uint8Array,
  lockTime: bigint, gas: bigint, isNative: boolean, payload: Uint8Array,
): Uint8Array {
  const inp = inputs[inputIndex];
  const payloadHash = isNative ? new Uint8Array(32) : hashBlake2b(payload);
  
  return hashBlake2b(concat(
    writeU16LE(txVersion),
    hashPrevOutputs(inputs),
    hashSequences(inputs),
    hashSigOpCounts(inputs),
    inp.txId, writeU32LE(inp.index),
    writeU16LE(inp.scriptVersion),
    writeU64LE(BigInt(inp.scriptPubKey.length)),
    inp.scriptPubKey,
    writeU64LE(inp.value),
    writeU64LE(inp.sequence),
    writeU8(inp.sigOpCount),
    hashOutputs(outputs),
    writeU64LE(lockTime),
    subnetworkId,
    writeU64LE(gas),
    payloadHash,
    writeU8(SIG_HASH_ALL),
  ));
}

// ============================================================================
// SEND KASPA VIA REST API
// ============================================================================
// Decode Kaspa bech32m address to scriptPublicKey bytes
function addressToScript(address: string): Uint8Array {
  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const colonIdx = address.indexOf(':');
  const dataPart = address.slice(colonIdx + 1);
  // Decode 5-bit to 8-bit
  const data5: number[] = [];
  for (const c of dataPart) { const v = CHARSET.indexOf(c); if (v >= 0) data5.push(v); }
  // Remove 8-char checksum
  const payload5 = data5.slice(0, data5.length - 8);
  // Convert 5-bit to 8-bit
  let bits = 0, acc = 0;
  const payload8: number[] = [];
  for (const v of payload5) { acc = (acc << 5) | v; bits += 5; while (bits >= 8) { bits -= 8; payload8.push((acc >> bits) & 0xff); acc &= (1 << bits) - 1; } }
  const payloadBytes = new Uint8Array(payload8);
  const version = payloadBytes[0]; // 0x00 = P2PK, 0x08 = P2SH
  const hashOrKey = payloadBytes.slice(1);
  if (version === 0x00) {
    // P2PK: <push 32> <xonly_pubkey> OP_CHECKSIG
    return hexToBytes('20' + bytesToHex(hashOrKey) + 'ac');
  } else if (version === 0x08) {
    // P2SH: OP_HASH256 <push 32> <script_hash> OP_EQUAL
    return hexToBytes('aa20' + bytesToHex(hashOrKey.slice(0, 32)) + '87');
  }
  throw new Error('Unsupported address version: 0x' + version.toString(16));
}

export async function sendKaspaViaRest(params: {
  senderAddress: string;
  recipientAddress: string;
  amountSompi: bigint;
  privateKeyHex: string;
  network: KaspaNetwork;
  payload?: string;
}): Promise<RestTxResult> {
  const { senderAddress, recipientAddress, amountSompi, privateKeyHex, network, payload } = params;
  
  try {
    // 1. Fetch raw UTXOs from L1 + filter through UTXO ledger
    const resp = await fetch(`${API_BASES[network]}/addresses/${senderAddress}/utxos`);
    if (!resp.ok) throw new Error(`UTXO fetch failed: ${resp.status}`);
    const utxos: UtxoResponse[] = await resp.json();
    console.log('[REST-TX] UTXOs fetched:', utxos.length, 'from', senderAddress);
    if (!utxos.length) return { success: false, error: 'No UTXOs available' };

    console.log('[REST-TX] First UTXO:', JSON.stringify(utxos[0]));
    
    // 2. Derive keys
    const privKeyBytes = hexToBytes(privateKeyHex);
    const pubKey = secp256k1.getPublicKey(privKeyBytes, true);
    const xOnlyPubkey = pubKey.slice(1);
    const senderScript = hexToBytes('20' + bytesToHex(xOnlyPubkey) + 'ac');
    console.log('[REST-TX] PubKey (compressed):', bytesToHex(pubKey));
    console.log('[REST-TX] x-only pubkey:', bytesToHex(xOnlyPubkey));
    console.log('[REST-TX] Sender script:', '20' + bytesToHex(xOnlyPubkey) + 'ac');
    const recipientScript = recipientAddress === senderAddress ? senderScript : addressToScript(recipientAddress);
    
    // Signature script length estimate: 1(push) + 64(sig) + 1(hashtype) = 66
    const sigScriptLen = 66;
    const payloadBytes = payload ? hexToBytes(payload) : new Uint8Array(0);
    
    // 3. Fee estimation loop — select UTXOs, calculate mass, adjust fee
    let fee = 10000n; // Initial estimate
    let selectedUtxos: UtxoResponse[] = [];
    let selectedAmount = 0n;
    
    for (let attempt = 0; attempt < 3; attempt++) {
      selectedUtxos = [];
      selectedAmount = 0n;
      const effectiveAmount = amountSompi === 0n ? 0n : amountSompi;
      const totalNeeded = effectiveAmount + fee;
      
      for (const u of utxos) {
        selectedUtxos.push(u);
        selectedAmount += BigInt(u.utxoEntry.amount);
        if (selectedAmount >= totalNeeded) break;
      }
      
      console.log('[REST-TX] Fee attempt', attempt, '- need:', totalNeeded.toString(), 'have:', selectedAmount.toString(), 'fee:', fee.toString());
      if (selectedAmount < totalNeeded) {
        return { success: false, error: `Insufficient balance: have ${selectedAmount} sompi, need ${totalNeeded}` };
      }
      
      // Build outputs for mass calculation
      const loopSendAmount = amountSompi === 0n ? selectedAmount - fee : amountSompi;
      const change = selectedAmount - loopSendAmount - fee;
      const outputScripts = [recipientScript];
      const outputValues = [loopSendAmount];
      if (change > 0n) {
        outputScripts.push(senderScript);
        outputValues.push(change);
      }
      
      // Dust check
      for (let i = 0; i < outputValues.length; i++) {
        if (isDust(outputValues[i], outputScripts[i].length)) {
          return { success: false, error: `Output ${i} is dust (${outputValues[i]} sompi). Minimum: ~546 sompi for P2PK.` };
        }
      }
      
      // Compute mass
      const cMass = computeMass(selectedUtxos.length, outputScripts, sigScriptLen, payloadBytes.length);
      const inputValues = selectedUtxos.map(u => BigInt(u.utxoEntry.amount));
      const sMass = storageMass(inputValues, outputValues);
      const totalMass = cMass > sMass ? cMass : sMass;
      
      if (totalMass > MAXIMUM_STANDARD_TX_MASS) {
        return { success: false, error: `Transaction too large: mass ${totalMass} exceeds limit ${MAXIMUM_STANDARD_TX_MASS}` };
      }
      
      // Calculate fee from mass
      const feeRate = await fetchFeeEstimate(network);
      const newFee = calculateMinFee(totalMass) * (feeRate > 1n ? feeRate : 1n);
      
      if (newFee <= fee) break; // Fee is sufficient
      fee = newFee; // Recalculate with higher fee
    }
    
    // 4. Build final outputs (amountSompi=0 means send all back to self)
    const sendAmount = amountSompi === 0n ? selectedAmount - fee : amountSompi;
    const change = selectedAmount - sendAmount - fee;
    const outputsData: { value: bigint; scriptVersion: number; script: Uint8Array }[] = [
      { value: sendAmount, scriptVersion: 0, script: recipientScript },
    ];
    if (change > 0n && !isDust(change, senderScript.length)) {
      outputsData.push({ value: change, scriptVersion: 0, script: senderScript });
    } else if (change > 0n) {
      fee += change; // Absorb dust change into fee
    }
    
    // 5. Sign inputs
    const inputsData = selectedUtxos.map(u => ({
      txId: hexToBytes(u.outpoint.transactionId),
      index: u.outpoint.index,
      sequence: 0n,
      sigOpCount: 1,
      scriptVersion: 0,
      scriptPubKey: hexToBytes(u.utxoEntry.scriptPublicKey.scriptPublicKey),
      value: BigInt(u.utxoEntry.amount),
    }));
    
    const subnetworkId = hexToBytes(SUBNETWORK_ID_NATIVE);
    const signedInputs: any[] = [];
    
    for (let i = 0; i < inputsData.length; i++) {
      const sighash = computeSighash(0, inputsData, outputsData, i, subnetworkId, 0n, 0n, true, payloadBytes);
      const sig = schnorr.sign(sighash, privKeyBytes);
      const sigWithType = concat(sig, writeU8(SIG_HASH_ALL));
      const sigScript = concat(writeU8(sigWithType.length), sigWithType);
      
      signedInputs.push({
        previousOutpoint: { transactionId: selectedUtxos[i].outpoint.transactionId, index: selectedUtxos[i].outpoint.index },
        signatureScript: bytesToHex(sigScript),
        sequence: '0',
        sigOpCount: 1,
      });
    }
    
    // 6. Build & submit
    const tx = {
      version: 0,
      inputs: signedInputs,
      outputs: outputsData.map(o => ({
        amount: o.value.toString(),
        scriptPublicKey: { version: o.scriptVersion, scriptPublicKey: bytesToHex(o.script) },
      })),
      lockTime: '0',
      subnetworkId: SUBNETWORK_ID_NATIVE,
      gas: '0',
      payload: payload || '',
    };
    
    console.log('[REST-TX] === SUBMITTING TX ===');
    console.log('[REST-TX] Inputs:', signedInputs.length);
    console.log('[REST-TX] Outputs:', outputsData.length);
    console.log('[REST-TX] Fee:', fee.toString(), 'sompi');
    console.log('[REST-TX] Payload:', payload ? payload.slice(0, 40) + '...' : 'none');
    console.log('[REST-TX] TX JSON:', JSON.stringify(tx).slice(0, 200) + '...');
    const submitResp = await fetch(`${API_BASES[network]}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction: tx, allowOrphan: false }),
    });
    
    if (!submitResp.ok) {
      const errBody = await submitResp.text();
      console.error('[REST-TX] Submit FAILED:', submitResp.status, errBody);
      return { success: false, error: `Submit failed (${submitResp.status}): ${errBody}` };
    }
    
    const result = await submitResp.json();
    console.log('[REST-TX] Submit response:', JSON.stringify(result));
    const txId = result.transactionId || bytesToHex(sha256(new TextEncoder().encode(JSON.stringify(tx))));
    const explorerBase = network === 'mainnet' ? 'https://explorer.kaspa.org/txs/' : 'https://explorer-tn10.kaspa.org/txs/';
    
    // Merkle archive: per-TX proof to Arweave (fire-and-forget, ~0.6 KB, free)
    uploadPerTxProof({
      txId,
      txIndex: 0,
      amountSompi: amountSompi,
      scriptPubKey: bytesToHex(recipientScript),
      daaScore: 0,
      txType: recipientAddress === senderAddress ? 'self' : 'send',
      balanceAfter: 0,
      uploadFn: async (data, tags) => {
        const r = await uploadToIrys(data, tags);
        return r.txId || '';
      },
      network: network === 'mainnet' ? 'mainnet' : 'testnet',
    }).catch(e => console.warn('[REST-TX] Merkle proof failed (non-fatal):', e));

    return { success: true, txId, explorerUrl: explorerBase + txId };
  } catch (e: any) {
    console.error('[REST-TX] EXCEPTION:', e.message, e.stack?.slice(0, 200));
    return { success: false, error: e.message || 'Transaction failed' };
  }
}

// ============================================================================
// INSCRIBE IDENTITY VIA REST
// ============================================================================
export async function inscribeIdentityViaRest(params: {
  identityHash: string; address: string; privateKeyHex: string; network: KaspaNetwork;
}): Promise<RestTxResult> {
  const marker = new TextEncoder().encode('KV2U');
  const version = new Uint8Array([0x02]);
  const hashBytes = hexToBytes(params.identityHash.slice(0, 64));
  const payloadData = concat(marker, version, hashBytes);
  
  console.log('[REST-TX] === inscribeIdentityViaRest ===');
  console.log('[REST-TX] address:', params.address);
  console.log('[REST-TX] network:', params.network);
  console.log('[REST-TX] identityHash:', params.identityHash.slice(0, 16) + '...');
  console.log('[REST-TX] payload:', bytesToHex(payloadData).slice(0, 40) + '...');
  return sendKaspaViaRest({
    senderAddress: params.address,
    recipientAddress: params.address,
    amountSompi: 0n,  // Send all back to self - inscription is in payload
    privateKeyHex: params.privateKeyHex,
    network: params.network,
    payload: bytesToHex(payloadData),
  });
}

// ============================================================================
// CHECK BALANCE VIA REST
// ============================================================================
export async function getBalanceRest(address: string, network: KaspaNetwork): Promise<bigint> {
  const resp = await fetch(`${API_BASES[network]}/addresses/${address}/balance`);
  if (!resp.ok) throw new Error(`Balance check failed: ${resp.status}`);
  const data = await resp.json();
  return BigInt(data.balance);
}

// ============================================================================
// FROST Release: Send from FROST address using pre-computed aggregate signature
// Instead of signing with a private key, uses the aggregate Schnorr sig
// from the FROST partial sig exchange
// ============================================================================

// ============================================================================
// CANONICAL FROST TX ? deterministic TX construction for 2-of-2 FROST
// Both buyer and seller MUST produce identical sighashes
// Rules: UTXOs sorted by txId+index, outputs sorted buyer?seller, no change
// ============================================================================
export interface CanonicalFrostTxParams {
  frostAddress: string;
  buyerAddress: string;
  sellerAddress: string;
  buyerAmountSompi: bigint;
  sellerAmountSompi: bigint;
  network: string;
  utxoSnapshot?: Array<{ t: string; i: number; a: string; s: string }>;
}

export interface CanonicalFrostTx {
  utxos: any[];
  inputs: { txId: Uint8Array; index: number; sequence: bigint; sigOpCount: number; scriptVersion: number; scriptPubKey: Uint8Array; value: bigint }[];
  outputs: { value: bigint; scriptVersion: number; script: Uint8Array }[];
  fee: bigint;
  totalIn: bigint;
}

export async function buildCanonicalFrostTx(params: CanonicalFrostTxParams): Promise<CanonicalFrostTx> {
  const { frostAddress, buyerAddress, sellerAddress, buyerAmountSompi, sellerAmountSompi, network } = params;
  const FEE = 10000n;

  // 1. Fetch and sort UTXOs deterministically (or use snapshot)
  let rawUtxos: any[];
  if (params.utxoSnapshot && params.utxoSnapshot.length > 0) {
    rawUtxos = params.utxoSnapshot.map(u => ({ outpoint: { transactionId: u.t, index: u.i }, utxoEntry: { amount: u.a, scriptPublicKey: { scriptPublicKey: u.s } } }));
    console.log('[FROST-Canonical] Using UTXO snapshot:', rawUtxos.length, 'UTXOs');
  } else {
    const apiBase = network === 'mainnet' ? 'https://api.kaspa.org' : (network === 'testnet-10' ? 'https://api-tn10.kaspa.org' : 'https://api-tn.kaspa.org');
    const utxoResp = await fetch(apiBase + '/addresses/' + frostAddress + '/utxos');
    if (!utxoResp.ok) throw new Error('Failed to fetch FROST UTXOs');
    rawUtxos = await utxoResp.json();
  }
  if (!rawUtxos || rawUtxos.length === 0) throw new Error('No UTXOs in FROST address');

  // Sort UTXOs by txId (ascending) then index (ascending) ? deterministic
  const utxos = [...rawUtxos].sort((a: any, b: any) => {
    const cmp = a.outpoint.transactionId.localeCompare(b.outpoint.transactionId);
    return cmp !== 0 ? cmp : a.outpoint.index - b.outpoint.index;
  });

  let totalIn = 0n;
  for (const u of utxos) totalIn += BigInt(u.utxoEntry.amount);

  // 2. Build outputs ? buyer first, seller second (deterministic order)
  const buyerScript = addressToScript(buyerAddress);
  const sellerScript = addressToScript(sellerAddress);
  
  // Distribute: total - fee split according to agreement amounts
  const available = totalIn - FEE;
  if (available <= 0n) throw new Error('FROST balance too low for fee');
  
  // Use exact agreement amounts if they sum to <= available
  let bOut = buyerAmountSompi;
  let sOut = sellerAmountSompi;
  const requestedTotal = bOut + sOut;
  
  if (requestedTotal > available) {
    // Scale down proportionally
    bOut = (available * buyerAmountSompi) / requestedTotal;
    sOut = available - bOut;
  } else if (requestedTotal < available) {
    // Extra goes to seller (dust remainder)
    sOut += (available - requestedTotal);
  }

  const outputs: { value: bigint; scriptVersion: number; script: Uint8Array }[] = [];
  if (bOut > 0n) outputs.push({ value: bOut, scriptVersion: 0, script: buyerScript });
  if (sOut > 0n) outputs.push({ value: sOut, scriptVersion: 0, script: sellerScript });

  // 3. Build input data
  const inputs = utxos.map((u: any) => ({
    txId: hexToBytes(u.outpoint.transactionId),
    index: u.outpoint.index,
    sequence: 0n,
    sigOpCount: 1,
    scriptVersion: 0,
    scriptPubKey: hexToBytes(u.utxoEntry.scriptPublicKey.scriptPublicKey),
    value: BigInt(u.utxoEntry.amount),
  }));

  return { utxos, inputs, outputs, fee: FEE, totalIn };
}

export function canonicalSighash(tx: CanonicalFrostTx, inputIndex: number): Uint8Array {
  const subnetId = hexToBytes('0000000000000000000000000000000000000000');
  return computeSighash(0, tx.inputs, tx.outputs, inputIndex, subnetId, 0n, 0n, true, new Uint8Array(0));
}

export async function submitCanonicalFrostTx(params: {
  tx: CanonicalFrostTx;
  perInputSigner: (sighashHex: string, inputIndex: number) => string;
  network: string;
  buyerSighashes?: string[];
}): Promise<{ success: boolean; txId?: string; error?: string }> {
  const { tx, perInputSigner, network } = params;
  const apiBase = network === 'mainnet' ? 'https://api.kaspa.org' : (network === 'testnet-10' ? 'https://api-tn10.kaspa.org' : 'https://api-tn.kaspa.org');

  const signedInputs = tx.utxos.map((u: any, idx: number) => {
    const sighash = params.buyerSighashes?.[idx] ? hexToBytes(params.buyerSighashes[idx]) : canonicalSighash(tx, idx);
    const sigHex = perInputSigner(params.buyerSighashes?.[idx] || bytesToHex(sighash), idx);
    console.log('[FROST-Canonical] Input', idx, 'sighash:', bytesToHex(sighash).slice(0,20), 'sig:', sigHex.slice(0,20));
    const sb = hexToBytes(sigHex);
    const swt = new Uint8Array(sb.length + 1); swt.set(sb); swt[sb.length] = 0x01;
    const ss = new Uint8Array(1 + swt.length); ss[0] = swt.length; ss.set(swt, 1);
    return { previousOutpoint: { transactionId: u.outpoint.transactionId, index: u.outpoint.index }, signatureScript: bytesToHex(ss), sequence: '0', sigOpCount: 1 };
  });

  const outputs = tx.outputs.map(o => ({
    amount: o.value.toString(),
    scriptPublicKey: { version: o.scriptVersion, scriptPublicKey: bytesToHex(o.script) },
  }));

  const txBody = {
    transaction: {
      version: 0, inputs: signedInputs, outputs,
      lockTime: '0', subnetworkId: '0000000000000000000000000000000000000000', gas: '0', payload: '',
    },
  };

  const submitResp = await fetch(apiBase + '/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(txBody),
  });

  if (!submitResp.ok) {
    const errText = await submitResp.text();
    return { success: false, error: 'L1 rejected: ' + errText };
  }

  const result = await submitResp.json();
  return { success: true, txId: result.transactionId || result.txId || '' };
}

export async function sendKaspaWithSignature(params: {
  senderAddress: string;
  recipientAddress: string;
  amountSompi: bigint;
  aggregateSignature?: string;  // 64-byte hex Schnorr sig (optional when perInputSigner used)
  aggregatePubkey: string;     // 33-byte compressed pubkey of the FROST address
  network: string;
  recipients?: Array<{ address: string; amount: bigint }>;
  perInputSigner?: (sighashHex: string, inputIndex: number) => string;
}): Promise<{ success: boolean; txId?: string; error?: string }> {
  const { senderAddress, recipientAddress, amountSompi, aggregateSignature, aggregatePubkey, network } = params;

  try {
    // 1. Fetch UTXOs for the FROST address
    const apiBase = network === 'mainnet' ? 'https://api.kaspa.org' : (network === 'testnet-10' ? 'https://api-tn10.kaspa.org' : 'https://api-tn.kaspa.org');
    const utxoResp = await fetch(apiBase + '/addresses/' + senderAddress + '/utxos');
    if (!utxoResp.ok) return { success: false, error: 'Failed to fetch FROST UTXOs' };
    const utxos = await utxoResp.json();
    
    if (!utxos || utxos.length === 0) {
      return { success: false, error: 'No UTXOs in FROST address' };
    }

    // 2. Select UTXOs to cover amount + fee
    const FEE = 10000n; // 0.0001 KAS
    const needed = amountSompi + FEE;
    let total = 0n;
    const selectedUtxos: any[] = [];
    for (const u of utxos) {
      selectedUtxos.push(u);
      total += BigInt(u.utxoEntry.amount);
      if (total >= needed) break;
    }
    if (total < needed) return { success: false, error: 'Insufficient FROST balance' };

    // 3. Build outputs
    const outputs: any[] = [];
    if (params.recipients && params.recipients.length > 0) {
      // Multi-output (simple collateral return)
      for (const r of params.recipients) {
        outputs.push({
          amount: r.amount.toString(),
          scriptPublicKey: { scriptPublicKey: addressToScriptPubKey(r.address), version: 0 },
        });
      }
    } else {
      outputs.push({
        amount: amountSompi.toString(),
        scriptPublicKey: { scriptPublicKey: addressToScriptPubKey(recipientAddress), version: 0 },
      });
    }
    
    // Change output
    const outputTotal = outputs.reduce((s, o) => s + BigInt(o.amount), 0n);
    const change = total - outputTotal - FEE;
    if (change > 0n) {
      outputs.push({
        amount: change.toString(),
        scriptPublicKey: { scriptPublicKey: addressToScriptPubKey(senderAddress), version: 0 },
      });
    }

    // 4. Build inputs with the AGGREGATE signature
    // The aggregate Schnorr sig is valid for ALL inputs from this FROST address
    // because they all share the same scriptPubKey (same aggregate pubkey)
    const SIG_HASH_ALL = 0x01;
    let sigScriptHex = '';
    if (aggregateSignature) {
      const sigBytes = hexToBytes(aggregateSignature);
      const sigWithType = new Uint8Array(sigBytes.length + 1);
      sigWithType.set(sigBytes);
      sigWithType[sigBytes.length] = SIG_HASH_ALL;
      const sigScript = new Uint8Array(1 + sigWithType.length);
      sigScript[0] = sigWithType.length;
      sigScript.set(sigWithType, 1);
      sigScriptHex = bytesToHex(sigScript);
    }

    // BUT: each input needs its OWN sighash signed
    // The aggregate sig was computed for a specific sighash
    // For multiple UTXOs, we need per-input sighashes
    // For simplicity: if there's only 1 UTXO, use the aggregate sig directly
    // For multiple UTXOs: the FROST protocol needs to produce a sig per input
    
    // IMPORTANT: For the initial implementation, we handle single-UTXO FROST addresses
    // Most FROST addresses will have exactly 1 UTXO (the collateral deposit)
    // Multi-UTXO FROST will be handled in a future update
    
    if (false /* multi-UTXO now handled by perInputSigner */) {
      console.warn('[FROST] Multiple UTXOs in FROST address — using first UTXO only');
      // Recalculate with single UTXO
      const singleUtxo = selectedUtxos[0];
      const singleAmount = BigInt(singleUtxo.utxoEntry.amount);
      if (singleAmount < needed) {
        return { success: false, error: 'Single UTXO insufficient. Multi-UTXO FROST not yet supported.' };
      }
      selectedUtxos.length = 1;
      // Recalculate change
      const newChange = singleAmount - outputTotal - FEE;
      if (newChange > 0n) {
        // Update or add change output
        const changeOut = outputs.find(o => o.scriptPublicKey.scriptPublicKey === addressToScriptPubKey(senderAddress));
        if (changeOut) changeOut.amount = newChange.toString();
        else outputs.push({
          amount: newChange.toString(),
          scriptPublicKey: { scriptPublicKey: addressToScriptPubKey(senderAddress), version: 0 },
        });
      }
    }

    // Per-input signing for multi-UTXO FROST
    const subnetId = hexToBytes('0000000000000000000000000000000000000000');
    const frostInputsData = selectedUtxos.map(u => ({ txId: hexToBytes(u.outpoint.transactionId), index: u.outpoint.index, sequence: 0n, sigOpCount: 1, scriptVersion: 0, scriptPubKey: hexToBytes(u.utxoEntry.scriptPublicKey.scriptPublicKey), value: BigInt(u.utxoEntry.amount) }));
    const frostOutputsData = outputs.map(o => ({ value: BigInt(o.amount), scriptVersion: 0, script: hexToBytes(o.scriptPublicKey.scriptPublicKey) }));
    const signedInputs = selectedUtxos.map((u, idx) => {
      let thisSigHex: string;
      if (params.perInputSigner) {
        const sighash = computeSighash(0, frostInputsData, frostOutputsData, idx, subnetId, 0n, 0n, true, new Uint8Array(0));
        thisSigHex = params.perInputSigner(bytesToHex(sighash), idx);
        console.log('[FROST-MultiUTXO] Input', idx, 'sighash:', bytesToHex(sighash).slice(0,20), 'sig:', thisSigHex.slice(0,20));
      } else { thisSigHex = aggregateSignature || ''; }
      const sb = hexToBytes(thisSigHex);
      const swt = new Uint8Array(sb.length + 1); swt.set(sb); swt[sb.length] = 0x01;
      const ss = new Uint8Array(1 + swt.length); ss[0] = swt.length; ss.set(swt, 1);
      return { previousOutpoint: { transactionId: u.outpoint.transactionId, index: u.outpoint.index }, signatureScript: bytesToHex(ss), sequence: '0', sigOpCount: 1 };
    });

    // 5. Submit transaction
    const txBody = {
      transaction: {
        version: 0,
        inputs: signedInputs,
        outputs,
        lockTime: '0',
        subnetworkId: '0000000000000000000000000000000000000000',
        gas: '0',
        payload: '',
      },
    };

    const submitResp = await fetch(apiBase + '/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(txBody),
    });

    if (!submitResp.ok) {
      const errText = await submitResp.text();
      return { success: false, error: 'L1 rejected: ' + errText };
    }

    const result = await submitResp.json();
    return { success: true, txId: result.transactionId || result.txId || '' };

  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// Helper: convert address to scriptPubKey (reuse existing if available)
function addressToScriptPubKey(address: string): string {
  // Kaspa P2PK scriptPubKey: OP_DATA_32 <32-byte-pubkey> OP_CHECKSIG
  // Decode bech32 address to get the pubkey hash
  // The address payload (after prefix:) is the x-only pubkey in bech32
  const parts = address.split(':');
  if (parts.length !== 2) throw new Error('Invalid address format');
  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const data: number[] = [];
  for (const c of parts[1]) {
    const idx = CHARSET.indexOf(c);
    if (idx === -1) throw new Error('Invalid bech32 char: ' + c);
    data.push(idx);
  }
  // Remove checksum (last 8 chars = 8 * 5 bits)
  const dataWithoutChecksum = data.slice(0, data.length - 8);
  // Version byte
  const version = dataWithoutChecksum[0];
  // Convert 5-bit groups to 8-bit bytes
  const payload5bit = dataWithoutChecksum.slice(1);
  const payload: number[] = [];
  let acc = 0, bits = 0;
  for (const v of payload5bit) {
    acc = (acc << 5) | v;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      payload.push((acc >> bits) & 0xff);
    }
  }
  // payload should be 32 bytes (x-only pubkey) or 33 bytes
  const pubkeyHex = payload.map(b => b.toString(16).padStart(2, '0')).join('');
  // P2PK: 20 <32-bytes> ac (OP_DATA_32 <pubkey> OP_CHECKSIG)
  return '20' + pubkeyHex.slice(0, 64) + 'ac';
}
