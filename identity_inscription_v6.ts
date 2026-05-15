// ============================================================================
// IDENTITY INSCRIPTION v7 — Production Ready
// ============================================================================
// KV2U marker → Kaspa L1 (via KaspaClient) + Arweave Turbo
//
// Changes from v6:
//   - Uses real KaspaClient (@kcoin/kaspa-web3.js) instead of stubs
//   - Uses @noble/curves and @noble/hashes for real crypto
//   - Proper Blake2b-256 sighash for Kaspa Schnorr
//   - Real secp256k1 Schnorr signing (BIP340)
// ============================================================================

import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import { secp256k1, schnorr } from '@noble/curves/secp256k1';
import { blake2b } from '@noble/hashes/blake2b';
import { sha256 } from '@noble/hashes/sha256';
import { KaspaClient, UtxoEntry } from './KaspaClient';
import type { KaspaNetwork } from './KaspaClient';
import { getDeviceHash } from './device_attestation';

// ── SecureStore keys ─────────────────────────────────────────────────────────
const SK = {
  KASPA_ADDRESS:        'kaspa_address',
  L1_PRIVKEY_ENC:       'kv_l1_privkey_enc',
  DEVICE_ENC_KEY:       'device_encryption_key',
  IDENTITY_INSCRIPTION: 'kv_identity_inscription',
  NETWORK:              'kaspa_network',
};

// ── Types ────────────────────────────────────────────────────────────────────
export type { KaspaNetwork };

export interface InscribeIdentityParams {
  identityHash: string;   // 64-char hex SHA256
  traitCount:   number;   // 9-18
  avatarJson:   string;   // canonical JSON for Arweave
  network?:     KaspaNetwork;
  deviceAttestation?: {
    device_hash: string;
    biometric_passed: boolean;
    is_real_device: boolean;
    auth_method: string;
    auth_timestamp: number;
  };
}

export interface InscribeIdentityResult {
  success:       boolean;
  kaspacTxId?:   string;
  arweaveTxId?:  string;
  arweaveUrl?:   string;
  explorerUrl?:  string;
  error?:        string;
  partial?:      boolean;
  needsFunding?: boolean;
  faucetUrl?:    string;
}

// ── Constants ────────────────────────────────────────────────────────────────
const IRYS_UPLOAD_URL  = 'https://node2.irys.xyz/tx';
const ARWEAVE_GATEWAY  = 'https://arweave.net';
const SUBNETWORK_NATIVE_HEX = '0000000000000000000000000000000000000000';
const DUST_SOMPI       = 546n;
const MIN_BALANCE_SOMPI = 10000n;

// ── Hex/Bytes helpers ────────────────────────────────────────────────────────
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum: number, arr: Uint8Array) => sum + arr.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// ── LE encoding helpers ──────────────────────────────────────────────────────
function w16LE(v: number): Uint8Array {
  return new Uint8Array([v & 0xff, (v >> 8) & 0xff]);
}
function w32LE(v: number): Uint8Array {
  const b = new Uint8Array(4);
  for (let i = 0; i < 4; i++) b[i] = (v >>> (i * 8)) & 0xff;
  return b;
}
function w64LE(v: bigint): Uint8Array {
  const b = new Uint8Array(8);
  for (let i = 0; i < 8; i++) b[i] = Number((v >> BigInt(i * 8)) & 0xffn);
  return b;
}
function le8(n: number): Uint8Array {
  const b = new Uint8Array(8);
  for (let i = 0; i < 8; i++) b[i] = (n >> (i * 8)) & 0xff;
  return b;
}

// ── Blake2b-256 (Kaspa sighash) ──────────────────────────────────────────────
function blake2b256(data: Uint8Array): Uint8Array {
  return blake2b(data, { dkLen: 32 });
}

// ── SHA256 async wrapper ─────────────────────────────────────────────────────
async function sha256Async(data: Uint8Array): Promise<Uint8Array> {
  return sha256(data);
}

// ── Private key retrieval (biometric-gated) ──────────────────────────────────
async function loadPrivateKeyHex(): Promise<string | null> {
  try {
    const auth = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Sign identity inscription',
      cancelLabel: 'Cancel',
      fallbackLabel: 'Use Passcode',
      disableDeviceFallback: false,
    });
    if (!auth.success) return null;

    const storedRaw = await SecureStore.getItemAsync(SK.L1_PRIVKEY_ENC);
    if (!storedRaw) return null;
    const stored = JSON.parse(storedRaw) as { privateKeyEnc: string };

    const deviceKey = await SecureStore.getItemAsync(SK.DEVICE_ENC_KEY);
    if (!deviceKey) return null;

    const encryptedHex = stored.privateKeyEnc;
    const combined = deviceKey + encryptedHex;
    const keyStream = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      combined,
    );

    const result: string[] = [];
    for (let i = 0; i < 64; i += 2) {
      const encByte = parseInt(encryptedHex.slice(i, i + 2), 16);
      const ksByte  = parseInt(keyStream.slice(i % keyStream.length, (i % keyStream.length) + 2), 16);
      result.push((encByte ^ ksByte).toString(16).padStart(2, '0'));
    }
    return result.join('');
  } catch (e) {
    console.error('[Inscription] key load error:', e);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// KASPA SIGHASH (BIP143-style with Blake2b-256)
// NO SIGHASH_ALL byte appended - Kaspa Schnorr doesn't use it
// ══════════════════════════════════════════════════════════════════════════════
interface TxInput {
  prevTxId:      string;
  prevIndex:     number;
  scriptPubKey:  Uint8Array;
  scriptVersion: number;
  value:         bigint;
  sequence:      bigint;
  sigOpCount:    number;
}

interface TxOutput {
  value:         bigint;
  scriptPubKey:  Uint8Array;
  scriptVersion: number;
}

function computeSigHash(
  version: number,
  inputs: TxInput[],
  outputs: TxOutput[],
  lockTime: bigint,
  payload: Uint8Array,
  inputIndex: number,
): Uint8Array {
  const hashPrevOutpoints = blake2b256(concatBytes(
    ...inputs.map(i => concatBytes(hexToBytes(i.prevTxId), w32LE(i.prevIndex)))
  ));

  const hashSequences = blake2b256(concatBytes(
    ...inputs.map(i => w64LE(i.sequence))
  ));

  const hashSigOpCounts = blake2b256(concatBytes(
    ...inputs.map(i => new Uint8Array([i.sigOpCount]))
  ));

  const hashOutputs = blake2b256(concatBytes(
    ...outputs.map(o => concatBytes(
      w64LE(o.value),
      w16LE(o.scriptVersion),
      w64LE(BigInt(o.scriptPubKey.length)),
      o.scriptPubKey,
    ))
  ));

  const inp = inputs[inputIndex];
  
  // Kaspa sighash preimage - NO SIGHASH_ALL byte at end
  const preimage = concatBytes(
    w16LE(version),
    hashPrevOutpoints,
    hashSequences,
    hashSigOpCounts,
    hexToBytes(inp.prevTxId),
    w32LE(inp.prevIndex),
    w16LE(inp.scriptVersion),
    w64LE(BigInt(inp.scriptPubKey.length)),
    inp.scriptPubKey,
    w64LE(inp.value),
    w64LE(inp.sequence),
    new Uint8Array([inp.sigOpCount]),
    hashOutputs,
    w64LE(lockTime),
    blake2b256(hexToBytes(SUBNETWORK_NATIVE_HEX)),
    w64LE(0n), // gas
    blake2b256(payload),
    // NO SIGHASH_ALL byte
  );

  return blake2b256(preimage);
}

// ── P2PK script building ─────────────────────────────────────────────────────
function buildP2PKScript(xOnlyPubKey: Uint8Array): Uint8Array {
  // Kaspa P2PK: OP_DATA_32 <32-byte x-only pubkey> OP_CHECKSIG
  return concatBytes(
    new Uint8Array([0x20]), // OP_DATA_32
    xOnlyPubKey,
    new Uint8Array([0xac]), // OP_CHECKSIG
  );
}

function buildSigScript(sig64: Uint8Array): Uint8Array {
  // Kaspa P2PK sig script: OP_DATA_64 <64-byte Schnorr sig>
  return concatBytes(
    new Uint8Array([0x40]), // OP_DATA_64
    sig64,
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// KASPA L1 INSCRIPTION via KaspaClient
// ══════════════════════════════════════════════════════════════════════════════
let clientCache: Map<KaspaNetwork, KaspaClient> = new Map();

async function getConnectedClient(network: KaspaNetwork): Promise<KaspaClient> {
  let client = clientCache.get(network);
  if (client && client.isConnected()) {
    return client;
  }
  
  client = new KaspaClient(network);
  await client.connect();
  clientCache.set(network, client);
  return client;
}

async function inscribeToKaspa(
  address: string,
  privKeyHex: string,
  payload: Uint8Array,
  network: KaspaNetwork,
): Promise<{ txId: string | null; needsFunding: boolean; faucetUrl: string | null; error?: string }> {
  try {
    // Derive keys
    const privKeyBytes = hexToBytes(privKeyHex);
    const pubPoint = secp256k1.ProjectivePoint.fromPrivateKey(privKeyBytes);
    const compressedPub = pubPoint.toRawBytes(true);
    const xOnly = compressedPub.slice(1); // Remove prefix byte
    const scriptPubKey = buildP2PKScript(xOnly);

    // Connect to Kaspa
    const client = await getConnectedClient(network);

    // Fetch spendable UTXOs
    const utxos = await client.getSpendableUtxos(address);
    const totalBalance = utxos.reduce((sum: bigint, u: UtxoEntry) => sum + u.amount, 0n);

    console.log(`[Kaspa] Address: ${address}`);
    console.log(`[Kaspa] Spendable: ${totalBalance} sompi (${utxos.length} UTXOs)`);

    if (totalBalance < MIN_BALANCE_SOMPI) {
      return {
        txId: null,
        needsFunding: true,
        faucetUrl: client.getFaucetUrl(),
        error: `Insufficient balance: have ${totalBalance} sompi, need ${MIN_BALANCE_SOMPI}`,
      };
    }

    // Select UTXOs (largest first)
    const sorted = [...utxos].sort((a: UtxoEntry, b: UtxoEntry) =>
      a.amount > b.amount ? -1 : a.amount < b.amount ? 1 : 0
    );

    // Estimate fee: ~3000 sompi for typical inscription
    const feeSompi = 3000n;
    const needed = DUST_SOMPI + feeSompi;

    const selected: UtxoEntry[] = [];
    let total = 0n;
    for (const u of sorted) {
      if (selected.length >= 10) break;
      selected.push(u);
      total += u.amount;
      if (total >= needed) break;
    }

    if (total < needed) {
      return {
        txId: null,
        needsFunding: true,
        faucetUrl: client.getFaucetUrl(),
        error: `Not enough UTXOs: have ${total}, need ${needed}`,
      };
    }

    // Build inputs
    const inputs: TxInput[] = selected.map((u: UtxoEntry) => ({
      prevTxId:      u.txId,
      prevIndex:     u.index,
      scriptPubKey,
      scriptVersion: 0,
      value:         u.amount,
      sequence:      0n,
      sigOpCount:    1,
    }));

    // Build outputs
    const outputs: TxOutput[] = [];
    
    // Output 0: Inscription dust output
    outputs.push({
      value: DUST_SOMPI,
      scriptPubKey,
      scriptVersion: 0,
    });

    // Output 1: Change
    const change = total - DUST_SOMPI - feeSompi;
    if (change > DUST_SOMPI) {
      outputs.push({
        value: change,
        scriptPubKey,
        scriptVersion: 0,
      });
    }

    // Sign each input with Schnorr BIP340
    const signedInputs = inputs.map((inp: TxInput, i: number) => {
      const sigHash = computeSigHash(0, inputs, outputs, 0n, payload, i);
      const sigBytes = schnorr.sign(sigHash, privKeyBytes);
      const sigScript = buildSigScript(sigBytes);

      return {
        previousOutpoint: {
          transactionId: inp.prevTxId,
          index: inp.prevIndex,
        },
        signatureScript: bytesToHex(sigScript),
        sequence: 0,
        sigOpCount: 1,
      };
    });

    // Build submittable transaction
    const tx = {
      version: 0,
      inputs: signedInputs,
      outputs: outputs.map((o: TxOutput) => ({
        value: o.value.toString(),
        scriptPublicKey: {
          version: o.scriptVersion,
          scriptPublicKey: bytesToHex(o.scriptPubKey),
        },
      })),
      lockTime: '0',
      subnetworkId: SUBNETWORK_NATIVE_HEX,
      gas: '0',
      payload: bytesToHex(payload),
    };

    // Submit
    console.log('[Kaspa] Submitting transaction...');
    const txId = await client.broadcastTransaction(tx);
    console.log(`[Kaspa] ✓ TX accepted: ${txId}`);

    return {
      txId,
      needsFunding: false,
      faucetUrl: null,
    };
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.error('[Kaspa] Inscription error:', errorMsg);
    return {
      txId: null,
      needsFunding: false,
      faucetUrl: null,
      error: errorMsg,
    };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ARWEAVE ANS-104 DATA ITEM (secp256k1 ECDSA for Turbo/Irys)
// ══════════════════════════════════════════════════════════════════════════════
function serializeTags(tags: { name: string; value: string }[]): Uint8Array {
  const enc = new TextEncoder();
  const le2 = (n: number) => new Uint8Array([n & 0xff, (n >> 8) & 0xff]);
  const parts: Uint8Array[] = [le2(tags.length)];
  for (const t of tags) {
    const n = enc.encode(t.name);
    const v = enc.encode(t.value);
    parts.push(le2(n.length), n, le2(v.length), v);
  }
  return concatBytes(...parts);
}

async function deepHash(items: Uint8Array[]): Promise<Uint8Array> {
  const enc = new TextEncoder();
  let h = sha256(concatBytes(
    sha256(enc.encode('list')),
    sha256(enc.encode(items.length.toString())),
  ));
  for (const item of items) {
    h = sha256(concatBytes(h, sha256(item)));
  }
  return h;
}

async function buildAns104Item(
  data: Uint8Array,
  tags: { name: string; value: string }[],
  privKeyHex: string,
): Promise<Uint8Array> {
  const privKeyBytes = hexToBytes(privKeyHex);
  const pubPoint = secp256k1.ProjectivePoint.fromPrivateKey(privKeyBytes);
  const compressedPub = pubPoint.toRawBytes(true);

  const serializedTags = serializeTags(tags);

  // DeepHash for ANS-104 signing
  const enc = new TextEncoder();
  const signatureData = await deepHash([
    enc.encode('dataitem'),
    enc.encode('1'),
    enc.encode('3'), // sig type 3 = secp256k1
    compressedPub,
    new Uint8Array(0), // target
    new Uint8Array(0), // anchor
    serializedTags,
    data,
  ]);

  // ECDSA signature for Arweave (not Schnorr)
  const sig = secp256k1.sign(signatureData, privKeyBytes);
  const signature = sig.toCompactRawBytes();

  // Build data item
  return concatBytes(
    signature,
    compressedPub,
    new Uint8Array([0]), // target present = false
    new Uint8Array([0]), // anchor present = false
    w16LE(tags.length),
    serializedTags,
    le8(data.length),
    data,
  );
}

async function uploadToIrys(itemBytes: Uint8Array): Promise<{ txId: string; url: string } | null> {
  try {
    const body = new Uint8Array(itemBytes).buffer as ArrayBuffer;
    
    const resp = await fetch(IRYS_UPLOAD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body,
      signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 30000); return c.signal; })(),
    });
    
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      console.error(`[Irys] Upload failed ${resp.status}: ${text}`);
      return null;
    }
    
    const json = await resp.json();
    const txId = json.id as string;
    return { txId, url: `${ARWEAVE_GATEWAY}/${txId}` };
  } catch (e) {
    console.error('[Irys] Upload error:', e);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// KV2U PAYLOAD FORMAT
// ══════════════════════════════════════════════════════════════════════════════
// KV2U:02 Binary Format (46 bytes total, fits in 80-byte OP_RETURN):
//   Bytes 0-3:   "KV2U" (ASCII marker)
//   Byte  4:     0x02 (version - binary format)
//   Bytes 5-36:  identityHash (32 bytes raw)
//   Byte  37:    traitCount (1 byte, 0-255)
//   Bytes 38-45: deviceAnchorHash (8 bytes raw)
// ══════════════════════════════════════════════════════════════════════════════

function formatKV2UPayload(
  identityHash: string,
  traitCount: number,
  deviceAnchorHash: string
): Uint8Array {
  const payload = new Uint8Array(46);
  
  // Bytes 0-3: "KV2U" marker
  payload[0] = 0x4B; // K
  payload[1] = 0x56; // V
  payload[2] = 0x32; // 2
  payload[3] = 0x55; // U
  
  // Byte 4: version 0x02 (binary format)
  payload[4] = 0x02;
  
  // Bytes 5-36: identityHash (32 bytes from 64-char hex)
  const hashBytes = hexToBytes(identityHash);
  payload.set(hashBytes, 5);
  
  // Byte 37: traitCount
  payload[37] = traitCount & 0xFF;
  
  // Bytes 38-45: deviceAnchorHash (8 bytes from 16-char hex)
  const deviceBytes = hexToBytes(deviceAnchorHash.slice(0, 16));
  payload.set(deviceBytes, 38);
  
  return payload;
}

// Parse KV2U:02 binary payload (for verification)
export function parseKV2UPayload(payload: Uint8Array): {
  valid: boolean;
  version?: number;
  identityHash?: string;
  traitCount?: number;
  deviceAnchorHash?: string;
} {
  // Check minimum length
  if (payload.length < 46) {
    return { valid: false };
  }
  
  // Check marker "KV2U"
  if (payload[0] !== 0x4B || payload[1] !== 0x56 || 
      payload[2] !== 0x32 || payload[3] !== 0x55) {
    return { valid: false };
  }
  
  const version = payload[4];
  
  // Version 0x02: binary format
  if (version === 0x02) {
    return {
      valid: true,
      version: 2,
      identityHash: bytesToHex(payload.slice(5, 37)),
      traitCount: payload[37],
      deviceAnchorHash: bytesToHex(payload.slice(38, 46)),
    };
  }
  
  // Version 0x01 or text format: legacy, can't parse here
  return { valid: false };
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ══════════════════════════════════════════════════════════════════════════════
export async function inscribeIdentity(
  params: InscribeIdentityParams,
): Promise<InscribeIdentityResult> {
  const { identityHash, traitCount, avatarJson, network = 'mainnet', deviceAttestation } = params;

  // Validate inputs
  if (!/^[a-f0-9]{64}$/i.test(identityHash)) {
    return { success: false, error: 'Invalid identity hash (must be 64-char hex)' };
  }
  if (traitCount < 9 || traitCount > 18) {
    return { success: false, error: 'Invalid trait count (must be 9-18)' };
  }

  // Load private key (biometric-gated)
  const privKeyHex = await loadPrivateKeyHex();
  if (!privKeyHex) {
    return { success: false, error: 'Biometric auth cancelled or key unavailable' };
  }

  // Read wallet address
  const address = await SecureStore.getItemAsync(SK.KASPA_ADDRESS) ?? '';
  if (!address) {
    return { success: false, error: 'No wallet address — generate wallet first' };
  }

  // Get device anchor hash (first 16 hex chars = 8 bytes)
  const deviceHash = await getDeviceHash();
  const deviceAnchorHash = deviceHash.slice(0, 16);

  // Build payloads - KV2U:02 binary format (46 bytes)
  const kaspaPayload = formatKV2UPayload(identityHash, traitCount, deviceAnchorHash);
  const arweaveData = new TextEncoder().encode(avatarJson);
  const arweaveTags = [
    { name: 'App-Name',        value: 'KasVillage' },
    { name: 'Content-Type',    value: 'application/json' },
    { name: 'KV-Type',         value: 'identity' },
    { name: 'KV-Identity',     value: identityHash },
    { name: 'KV-TraitCount',   value: String(traitCount) },
    { name: 'KV-Version',      value: 'KV2U:02' },
    { name: 'KV-DeviceAnchor', value: deviceAnchorHash },
    { name: 'KV-Network',      value: network },
    // Device attestation tags (queryable via GraphQL)
    ...(deviceAttestation ? [
      { name: 'KV-AuthMethod',      value: deviceAttestation.auth_method },
      { name: 'KV-BiometricPassed', value: String(deviceAttestation.biometric_passed) },
      { name: 'KV-RealDevice',      value: String(deviceAttestation.is_real_device) },
      { name: 'KV-AuthTimestamp',    value: String(deviceAttestation.auth_timestamp) },
      { name: 'KV-DeviceHash',      value: deviceAttestation.device_hash },
    ] : []),
  ];

  // Run L1 + Arweave in parallel
  const [kaspaResult, arweaveResult] = await Promise.allSettled([
    inscribeToKaspa(address, privKeyHex, kaspaPayload, network),
    buildAns104Item(arweaveData, arweaveTags, privKeyHex).then(uploadToIrys),
  ]);

  // Extract results
  const kaspaData = kaspaResult.status === 'fulfilled' ? kaspaResult.value : null;
  const arweaveData2 = arweaveResult.status === 'fulfilled' ? arweaveResult.value : null;

  const kaspacTxId = kaspaData?.txId ?? undefined;
  const arweaveTxId = arweaveData2?.txId;
  const arweaveUrl = arweaveData2?.url;

  // Get explorer URL
  let explorerUrl: string | undefined;
  if (kaspacTxId) {
    const client = clientCache.get(network);
    if (client) {
      explorerUrl = client.getExplorerUrl(kaspacTxId);
    }
  }

  // Check if needs funding
  if (kaspaData?.needsFunding) {
    return {
      success: false,
      error: kaspaData.error || 'Insufficient KAS balance',
      needsFunding: true,
      faucetUrl: kaspaData.faucetUrl ?? undefined,
      arweaveTxId,
      arweaveUrl,
      partial: !!arweaveTxId,
    };
  }

  const success = !!(kaspacTxId || arweaveTxId);
  const partial = success && !(kaspacTxId && arweaveTxId);

  // Persist results
  if (success) {
    await SecureStore.setItemAsync(SK.IDENTITY_INSCRIPTION, JSON.stringify({
      identityHash,
      traitCount,
      network,
      kaspacTxId: kaspacTxId ?? null,
      arweaveTxId: arweaveTxId ?? null,
      arweaveUrl: arweaveUrl ?? null,
      explorerUrl: explorerUrl ?? null,
      timestamp: Date.now(),
    }));
  }

  console.log(`[Inscription] L1=${kaspacTxId ?? 'FAILED'} AR=${arweaveTxId ?? 'FAILED'}`);

  if (!success) {
    const errors: string[] = [];
    if (kaspaResult.status === 'rejected') {
      errors.push(`L1: ${kaspaResult.reason}`);
    } else if (kaspaData?.error) {
      errors.push(`L1: ${kaspaData.error}`);
    } else if (!kaspacTxId) {
      errors.push('L1: no txId');
    }
    if (arweaveResult.status === 'rejected') {
      errors.push(`AR: ${arweaveResult.reason}`);
    } else if (!arweaveTxId) {
      errors.push('AR: upload failed');
    }
    return { success: false, error: errors.join(' | ') };
  }

  return {
    success: true,
    kaspacTxId,
    arweaveTxId,
    arweaveUrl,
    explorerUrl,
    partial,
  };
}

export async function getStoredInscription(): Promise<{
  identityHash:  string;
  traitCount:    number;
  network:       KaspaNetwork;
  kaspacTxId:    string | null;
  arweaveTxId:   string | null;
  arweaveUrl:    string | null;
  explorerUrl:   string | null;
  timestamp:     number;
} | null> {
  try {
    const raw = await SecureStore.getItemAsync(SK.IDENTITY_INSCRIPTION);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function getNetworkFromStorage(): Promise<KaspaNetwork> {
  try {
    const network = await SecureStore.getItemAsync(SK.NETWORK);
    if (network === 'testnet-10' || network === 'testnet-11') {
      return network;
    }
    return 'mainnet';
  } catch {
    return 'mainnet';
  }
}

export async function setNetworkInStorage(network: KaspaNetwork): Promise<void> {
  await SecureStore.setItemAsync(SK.NETWORK, network);
}

// ══════════════════════════════════════════════════════════════════════════════
// UTILITY: Get connected client for external use
// ══════════════════════════════════════════════════════════════════════════════
export async function getKaspaClient(network: KaspaNetwork): Promise<KaspaClient> {
  return getConnectedClient(network);
}