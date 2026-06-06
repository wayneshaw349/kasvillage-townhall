

// ============================================================================
// FROST 2-of-2 BIP340 — Proper Nonce Protocol
// Round 1: generateFrostNonce() — called during Agreed-Send, R shared on TownHall
// Round 2: computeFrostPartialS() — called after both R values known
// Aggregate: aggregateFrostSig() — combines into valid BIP340 Schnorr sig
// ============================================================================

export interface FrostNonce {
  R_hex: string;           // 33-byte compressed point (public, safe to share)
  k_private: string;       // scalar (PRIVATE — never leaves device)
  d_tweaked: string;        // tweaked private key (PRIVATE)
  message_hex: string;      // the sighash both parties agree on
}

/**
 * Round 1: Generate deterministic nonce for FROST signing.
 * Called during Agreed-Send. R_hex is shared via TownHall/Arweave.
 * k_private and d_tweaked stay on device.
 */
export function generateFrostNonce(params: {
  frostAddress: FrostAddress;
  recipientAddress: string;
  amountSompi: bigint;
  privateKeyHex: string;
  recipients?: Array<{ address: string; amount: bigint }>;
}): FrostNonce {
  const N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
  const { frostAddress, recipientAddress, amountSompi, privateKeyHex, recipients } = params;

  // Deterministic message using Kaspa's Blake2b sighash
  // Both parties compute identical message from the same agreement data
  const messageData = new TextEncoder().encode(JSON.stringify({
    frost: frostAddress.address,
    aggPubkey: frostAddress.aggregatedPubkey,
    to: recipientAddress || (recipients ? recipients.map(r => r.address).join(',') : ''),
    amount: amountSompi.toString(),
  }));
  const message = kaspaBlake2b(messageData);

  // Tweaked private key: adjust for P_agg parity (BIP340)
  const sk_raw = BigInt('0x' + privateKeyHex);
  const P_agg = (secp as any).ProjectivePoint.fromHex(frostAddress.aggregatedPubkey);
  const P_agg_bytes = P_agg.toRawBytes(true);
  // MuSig tweak: d = a_i * sk_raw (mod N)
  const myPubkey = bytesToHex((secp as any).getPublicKey(hexToBytes(privateKeyHex), true));
  const [_pk1, _pk2] = [frostAddress.pubkeyA, frostAddress.pubkeyB].sort();
  const _fnonce = (frostAddress?.frostCounter && frostAddress.frostCounter > 0) ? new TextEncoder().encode(String(frostAddress.frostCounter)) : new Uint8Array(0);
  const _L = sha256(new Uint8Array([...hexToBytes(_pk1), ...hexToBytes(_pk2), ..._fnonce]));
  const _myA = BigInt('0x' + bytesToHex(sha256(new Uint8Array([..._L, ...hexToBytes(myPubkey === _pk1 ? _pk1 : _pk2)])))) % N;
  const sk_tweaked = (sk_raw * _myA) % N;
  let d = sk_tweaked;
  if (P_agg_bytes[0] === 0x03) d = (N - sk_tweaked) % N;

  // Deterministic nonce: k = Blake2b(d || message) mod N
  // Uses Kaspa's hash function for consistency
  const k_bytes = kaspaBlake2b(new Uint8Array([
    ...hexToBytes(d.toString(16).padStart(64, '0')),
    ...message,
  ]));
  let k = BigInt('0x' + bytesToHex(k_bytes)) % N;
  if (k === 0n) k = 1n;

  // R = k * G
  const R = (secp as any).ProjectivePoint.BASE.multiply(k);

  return {
    R_hex: bytesToHex(R.toRawBytes(true)),
    k_private: k.toString(16).padStart(64, '0'),
    d_tweaked: d.toString(16).padStart(64, '0'),
    message_hex: bytesToHex(message),
  };
}

/**
 * Round 2: Compute partial s value after receiving counterparty's R.
 * Called after both R values are known (from Agreed-Send exchange).
 * Returns s_i (32 bytes hex) — safe to share, cannot derive private key.
 */
export function computeFrostPartialS(params: {
  myNonce: FrostNonce;
  counterpartyR_hex: string;
  frostAddress: FrostAddress;
  sighash_hex?: string; // real Kaspa sighash ? overrides myNonce.message_hex for challenge e
}): { s_hex: string; R_agg_x_hex: string } {
  const N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
  const { myNonce, counterpartyR_hex, frostAddress } = params;

  // R_agg = R_mine + R_theirs
  const R_mine = (secp as any).ProjectivePoint.fromHex(myNonce.R_hex);
  const R_theirs = (secp as any).ProjectivePoint.fromHex(counterpartyR_hex);
  let R_agg = R_mine.add(R_theirs);

  // BIP340: if R_agg has odd y, negate k
  let k = BigInt('0x' + myNonce.k_private);
  const R_agg_bytes = R_agg.toRawBytes(true);
  if (R_agg_bytes[0] === 0x03) {
    k = (N - k) % N;
    R_agg = R_agg.negate();
  }
  const R_agg_x = R_agg.toRawBytes(true).slice(1);

  // P_agg x-only
  const P_agg = (secp as any).ProjectivePoint.fromHex(frostAddress.aggregatedPubkey);
  const P_agg_full = P_agg.toRawBytes(true);
  const P_x = P_agg_full[0] === 0x03 ? P_agg.negate().toRawBytes(true).slice(1) : P_agg_full.slice(1);

  // Challenge e = BIP340 tagged SHA256 (NOT Blake2b)
  // Blake2b is for sighash only. Challenge uses BIP340 tagged SHA256.
  const message = hexToBytes(params.sighash_hex || myNonce.message_hex); // use real sighash if provided
  // challengeInput built inline in tagged hash below
  const challengeTag = sha256(new TextEncoder().encode("BIP0340/challenge"));
  const eHash = sha256(new Uint8Array([...challengeTag, ...challengeTag, ...R_agg_x, ...P_x, ...message]));
  const e = BigInt('0x' + bytesToHex(eHash)) % N;

  // s_i = k_i + e * d_i (mod N)
  const d = BigInt('0x' + myNonce.d_tweaked);
  const s = (k + e * d) % N;

  return {
    s_hex: s.toString(16).padStart(64, '0'),
    R_agg_x_hex: bytesToHex(R_agg_x),
  };
}

/**
 * Aggregate: Combine two partial s values into a valid BIP340 Schnorr signature.
 * Both parties computed s with the SAME R_agg and e — so s_A + s_B is valid.
 */
export function aggregateFrostSig(params: {
  s_A_hex: string;
  s_B_hex: string;
  R_agg_x_hex: string;
}): string {
  const N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
  const { s_A_hex, s_B_hex, R_agg_x_hex } = params;

  const s_A = BigInt('0x' + s_A_hex);
  const s_B = BigInt('0x' + s_B_hex);
  const s_agg = (s_A + s_B) % N;

  const sig = new Uint8Array(64);
  sig.set(hexToBytes(R_agg_x_hex), 0);
  sig.set(hexToBytes(s_agg.toString(16).padStart(64, '0')), 32);

  return bytesToHex(sig);
}
// ============================================================================
// KASVILLAGE - FROST 2-OF-2 COMPLETE MODULE
// ============================================================================

import { Platform, PermissionsAndroid, Linking } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as secp from '@noble/secp256k1';
import { schnorr } from '@noble/curves/secp256k1';

import { sha256 } from '@noble/hashes/sha256';
import { blake2b } from '@noble/hashes/blake2b';
const N_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');

// ============================================================================
// KASPA SIGHASH — Blake2b-256 with TransactionSigningHash domain key
// Must match kaspa_rest_tx.ts computeSighash exactly
// ============================================================================
const KASPA_HASH_KEY = new TextEncoder().encode('TransactionSigningHash');

function kaspaBlake2b(data: Uint8Array): Uint8Array {
  return blake2b(data, { dkLen: 32, key: KASPA_HASH_KEY } as any);
}

// ============================================================================
// HELPERS
// ============================================================================

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

// base-64 replacements using native btoa/atob (React Native has these)
function strToB64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function b64ToStr(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// @noble/secp256k1 v2 HMAC wiring
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { hmac } = require('@noble/hashes/hmac') as { hmac: (h: unknown, k: Uint8Array, m: Uint8Array) => Uint8Array };
  (secp as any).etc.hmacSha256Sync = (key: Uint8Array, ...msgs: Uint8Array[]) => {
    const cat = new Uint8Array(msgs.reduce((n, m) => n + m.length, 0));
    let off = 0; for (const m of msgs) { cat.set(m, off); off += m.length; }
    return hmac(sha256, key, cat);
  };
} catch {}

// ============================================================================
// TYPES
// ============================================================================

export type KaspaNetwork = 'mainnet' | 'testnet-10' | 'testnet-11';
export type ExchangeMethod = 'qr' | 'ble' | 'wifi' | 'tailscale' | 'townhall';

export interface FrostAddress {
  frostCounter?: number;
  address: string;
  pubkeyA: string;
  pubkeyB: string;
  aggregatedPubkey: string;
  network: KaspaNetwork;
  sessionId: string;
  verificationCode: string;
  createdAt: number;
}

export interface FrostPartialSig {
  partialSig: string;
  messageHash: string;
  signerPubkey: string;
  recipientAddress: string;
  amountSompi: bigint;
  timestamp: number;
}

export interface FrostInscription {
  type: 'C' | 'L' | 'R' | 'D';
  frostAddress: string;
  agreementHash: string;
  amountSompi: bigint;
  txId?: string;
}

export interface PeerInfo {
  id: string;
  pubkey: string;
  name?: string;
  method: ExchangeMethod;
  rssi?: number;
  ip?: string;
}

export interface ExchangeProgress {
  phase: 'init' | 'scanning' | 'connecting' | 'exchanging' | 'verifying' | 'complete' | 'error';
  progress: number;
  message: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TOWNHALL_BASE = 'https://townhall.kasvillage.dev';
const BLE_SERVICE_UUID = '6b617376-696c-6c61-6765-66726f737401';
const BLE_CHAR_PUBKEY_UUID = '6b617376-696c-6c61-6765-66726f737402';
const BLE_CHAR_SIG_UUID = '6b617376-696c-6c61-6765-66726f737403';
const FROST_P2P_PORT = 8788;
const KVF_PREFIX = 'KVF';

// ============================================================================
// SECTION 1: LOCAL FROST DERIVATION
// ============================================================================

export function deriveAggregatePubkey(pubkeyA: string, pubkeyB: string, agreementId?: string, nonce?: number): string {
  const [pk1, pk2] = [pubkeyA, pubkeyB].sort();
  // MuSig-style key aggregation with real EC point math
  const _nb = (nonce && nonce > 0) ? new TextEncoder().encode(String(nonce)) : new Uint8Array(0);
  const L = sha256(new Uint8Array([...hexToBytes(pk1), ...hexToBytes(pk2), ..._nb]));
  const a1 = sha256(new Uint8Array([...L, ...hexToBytes(pk1)]));
  const a2 = sha256(new Uint8Array([...L, ...hexToBytes(pk2)]));
  const N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
  const a1Scalar = BigInt('0x' + bytesToHex(a1)) % N;
  const a2Scalar = BigInt('0x' + bytesToHex(a2)) % N;
  // P_agg = a1*P1 + a2*P2 (EC point addition on secp256k1)
  const P1 = (secp as any).ProjectivePoint.fromHex(pk1);
  const P2 = (secp as any).ProjectivePoint.fromHex(pk2);
  const P_agg = P1.multiply(a1Scalar).add(P2.multiply(a2Scalar));
  return bytesToHex(P_agg.toRawBytes(true)); // 33-byte compressed pubkey
}

export function aggregateToAddress(aggregatePubkey: string, network: KaspaNetwork): string {
  const prefix = network === 'mainnet' ? 'kaspa' : 'kaspatest';
  // aggregatePubkey is a real 33-byte compressed EC point
  // Use x-only (32 bytes) for P2PK address — looks like a normal Kaspa address
  const aggBytes = hexToBytes(aggregatePubkey);
  const xOnlyBytes = aggBytes.length === 33 ? aggBytes.slice(1) : aggBytes;

  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  function kaspaPolymod(values: number[]): bigint {
    let c = 1n;
    for (const d of values) {
      const c0 = c >> 35n;
      c = ((c & 0x07fffffffffn) << 5n) ^ BigInt(d);
      if (c0 & 0x01n) c ^= 0x98f2bc8e61n;
      if (c0 & 0x02n) c ^= 0x79b76d99e2n;
      if (c0 & 0x04n) c ^= 0xf33e5fb3c4n;
      if (c0 & 0x08n) c ^= 0xae2eabe2a8n;
      if (c0 & 0x10n) c ^= 0x1e4f43e470n;
    }
    return c ^ 1n;
  }
  function conv8to5(payload: number[]): number[] {
    const result: number[] = [];
    let buff = 0, bits = 0;
    for (const c of payload) {
      buff = (buff << 8) | c; bits += 8;
      while (bits >= 5) { bits -= 5; result.push((buff >> bits) & 31); buff &= (1 << bits) - 1; }
    }
    if (bits > 0) result.push((buff << (5 - bits)) & 31);
    return result;
  }
  // Version byte 0x00 = P2PK + 32-byte x-only pubkey (normal Kaspa address)
  const fullPayload = [0x00, ...Array.from(xOnlyBytes)];
  const fivebitPayload = conv8to5(fullPayload);
  const fivebitPrefix = Array.from(prefix).map(c => c.charCodeAt(0) & 0x1f);
  const checksumInput = [...fivebitPrefix, 0, ...fivebitPayload, 0, 0, 0, 0, 0, 0, 0, 0];
  const cs = kaspaPolymod(checksumInput);
  const csBytes: number[] = [];
  for (let i = 4; i >= 0; i--) csBytes.push(Number((cs >> BigInt(i * 8)) & 0xFFn));
  const cs5bit = conv8to5(csBytes);
  let addr = prefix + ':';
  for (const d of [...fivebitPayload, ...cs5bit]) addr += CHARSET[d];
  return addr;
}

export function generateVerificationCode(pubkeyA: string, pubkeyB: string): string {
  const [pk1, pk2] = [pubkeyA, pubkeyB].sort();
  const hash = sha256(new TextEncoder().encode('FROST_VERIFY:' + pk1 + pk2));
  return bytesToHex(hash).slice(0, 4).toUpperCase();
}

export function deriveFrostAddressLocal(params: {
  pubkeyA: string;
  pubkeyB: string;
  network: KaspaNetwork;
  agreementId?: string;
}): FrostAddress {
  const { pubkeyA, pubkeyB, network, agreementId, frostCounter } = params;
  const [pk1, pk2] = [pubkeyA, pubkeyB].sort();
  const aggregatedPubkey = deriveAggregatePubkey(pk1, pk2, agreementId, frostCounter);
  const address = aggregateToAddress(aggregatedPubkey, network);
  const verificationCode = generateVerificationCode(pk1, pk2);

  return {
    address,
    pubkeyA: pk1,
    pubkeyB: pk2,
    aggregatedPubkey,
    network,
    frostCounter,
    sessionId: agreementId || `FROST_${Date.now()}`,
    verificationCode,
    createdAt: Date.now(),
  };
}

export function verifyFrostAddress(
  claimedAddress: string,
  myPubkey: string,
  theirPubkey: string,
  network: KaspaNetwork
): { valid: boolean; expected: string; code: string } {
  const local = deriveFrostAddressLocal({ pubkeyA: myPubkey, pubkeyB: theirPubkey, network });
  return {
    valid: local.address === claimedAddress,
    expected: local.address,
    code: local.verificationCode,
  };
}

// ============================================================================
// SECTION 2: LOCAL PARTIAL SIGNATURE
// ============================================================================

export function createPartialSigLocal(params: {
  frostAddress: FrostAddress;
  recipientAddress?: string;
  amountSompi: bigint;
  privateKeyHex: string;
  recipients?: Array<{ address: string; amount: bigint }>;
}): FrostPartialSig {
  const { frostAddress, recipientAddress, amountSompi, privateKeyHex, recipients } = params;
  const N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');

  // 1. Build deterministic message (both parties compute the same message)
  const messageData = new TextEncoder().encode(JSON.stringify({
    frost: frostAddress.address,
    to: recipientAddress || (recipients ? recipients.map(r => r.address).join(',') : ''),
    amount: amountSompi.toString(),
    recipients: recipients ? recipients.map(r => ({ address: r.address, amount: r.amount.toString() })) : undefined,
  }));
  const message = kaspaBlake2b(messageData);

  // 2. Compute tweaked private key: d_i = a_i * sk_i
  // a_i is derived from the MuSig key aggregation (same as deriveAggregatePubkey)
  const aggPubkeyHex = frostAddress.aggregatedPubkey;
  const myPubkey = bytesToHex((secp as any).getPublicKey(hexToBytes(privateKeyHex), true));
  
  // Determine which party we are (pk1 or pk2) based on sorted order
  // We need the counterparty pubkey — derive from the aggregate
  // Actually, we have both pubkeys in the FROST address derivation
  // For now, compute our own tweak factor
  const L_input = frostAddress.aggregatedPubkey; // This encodes both pubkeys
  
  // Recompute our tweak: hash the aggregate pubkey context with our pubkey
  // This must match what deriveAggregatePubkey computed
  const sk_raw = BigInt('0x' + privateKeyHex);
  
  // Get P_agg parity for BIP340 adjustment
  const P_agg = (secp as any).ProjectivePoint.fromHex(aggPubkeyHex);
  const P_agg_bytes = P_agg.toRawBytes(true);
  const needNegatePubkey = P_agg_bytes[0] === 0x03;
  
  // For the partial sig, we need our tweaked key
  // The tweak a_i was computed in deriveAggregatePubkey as:
  // L = SHA256(pk1 + pk2 + agreementId)
  // a_i = SHA256(L || pk_i) mod N
  // Since we don't have the counterparty pubkey here directly,
  // we store the tweak in frostAddress or recompute it
  // For now: sign with our raw private key, adjusted for P_agg parity
  // The aggregation will work because createPartialSigLocal is called
  // with the same message by both parties
  
  // MuSig tweak: d = a_i * sk_raw (mod N)
  const _myPub = bytesToHex((secp as any).getPublicKey(hexToBytes(privateKeyHex), true));
  const [_pk1, _pk2] = [frostAddress.pubkeyA, frostAddress.pubkeyB].sort();
  const _fnonce = (frostAddress?.frostCounter && frostAddress.frostCounter > 0) ? new TextEncoder().encode(String(frostAddress.frostCounter)) : new Uint8Array(0);
  const _L = sha256(new Uint8Array([...hexToBytes(_pk1), ...hexToBytes(_pk2), ..._fnonce]));
  const _myA = BigInt('0x' + bytesToHex(sha256(new Uint8Array([..._L, ...hexToBytes(_myPub === _pk1 ? _pk1 : _pk2)])))) % N;
  const sk_tweaked = (sk_raw * _myA) % N;
  let d = sk_tweaked;
  // BIP340: if P (our pubkey) has odd y... but for MuSig we adjust for P_agg parity
  if (needNegatePubkey) d = (N - sk_tweaked) % N;

  // 3. Deterministic nonce: k = SHA256(d || message) mod N
  const k_bytes = sha256(new Uint8Array([
    ...hexToBytes(d.toString(16).padStart(64, '0')),
    ...message,
  ]));
  let k = BigInt('0x' + bytesToHex(k_bytes)) % N;
  if (k === 0n) k = 1n;

  // 4. R = k * G
  let R = (secp as any).ProjectivePoint.BASE.multiply(k);
  const R_bytes = R.toRawBytes(true);
  // Note: R parity adjustment happens during aggregation, not here
  // Each party sends their R as-is

  // 5. Compute partial s (without challenge e — that requires R_agg which we don't have yet)
  // Strategy: send (R, k, d) context as the "partial sig"
  // Actually: send R_x (32 bytes) as first half, and a commitment
  // 
  // Better strategy: the partial sig IS just a Schnorr sig with our tweaked key
  // The aggregation function handles combining R values and recomputing e
  
  // Sign with tweaked key using BIP340 schnorr
  // Deterministic FROST nonce: k = SHA256(d_tweaked || P_agg || tx_message)
  const kInput = new Uint8Array([...hexToBytes(d.toString(16).padStart(64, '0')), ...hexToBytes(aggPubkeyHex), ...message]);
  const kHash = sha256(kInput);
  const kFrost = BigInt('0x' + bytesToHex(kHash)) % N_ORDER;
  if (kFrost === 0n) throw new Error('Invalid nonce');
  const R_point = (secp as any).ProjectivePoint.BASE.multiply(kFrost);
  const R_x = R_point.toRawBytes(true).slice(1);
  const aggXOnly = hexToBytes(aggPubkeyHex).length === 33 ? hexToBytes(aggPubkeyHex).slice(1) : hexToBytes(aggPubkeyHex);
  const e_hash = blake2b(new Uint8Array([...R_x, ...aggXOnly, ...message]), { dkLen: 32 });
  const e_val = BigInt('0x' + bytesToHex(e_hash)) % N_ORDER;
  const s_i = (kFrost + e_val * d) % N_ORDER;
  const sigBytes = new Uint8Array(64);
  sigBytes.set(R_x, 0);
  sigBytes.set(hexToBytes(s_i.toString(16).padStart(64, '0')), 32);
  const messageHash = bytesToHex(message);
  const partialSig = bytesToHex(sigBytes);

  return {
    partialSig,
    messageHash,
    signerPubkey: myPubkey,
    recipientAddress: (recipientAddress || '') as string,
    amountSompi,
    timestamp: Date.now(),
  };
}

export function aggregatePartialSigs(sigA: string, sigB: string): string {
  const sigABytes = hexToBytes(sigA);
  const sigBBytes = hexToBytes(sigB);

  if (sigABytes.length !== 64 || sigBBytes.length !== 64) {
    throw new Error('Invalid partial signature length');
  }

  // R_agg = R_A + R_B (EC point addition on secp256k1)
  // R is x-only (32 bytes) — lift to full point, add, compress back to x-only
  let R_A; try { R_A = (secp as any).ProjectivePoint.fromHex(new Uint8Array([0x02, ...sigABytes.slice(0, 32)])); } catch { R_A = (secp as any).ProjectivePoint.fromHex(new Uint8Array([0x03, ...sigABytes.slice(0, 32)])); }
  let R_B; try { R_B = (secp as any).ProjectivePoint.fromHex(new Uint8Array([0x02, ...sigBBytes.slice(0, 32)])); } catch { R_B = (secp as any).ProjectivePoint.fromHex(new Uint8Array([0x03, ...sigBBytes.slice(0, 32)])); }
  const R_agg = R_A.add(R_B);
  const R_aggBytes = R_agg.toRawBytes(true); // 33 bytes compressed
  const R_aggX = R_aggBytes.slice(1); // 32 bytes x-only

  // s_agg = s_A + s_B mod N
  const N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
  const s_A = BigInt('0x' + bytesToHex(sigABytes.slice(32)));
  const s_B = BigInt('0x' + bytesToHex(sigBBytes.slice(32)));
  const s_agg = (s_A + s_B) % N;
  const s_aggHex = s_agg.toString(16).padStart(64, '0');

  // Combine: R_agg (32 bytes) + s_agg (32 bytes) = 64 byte Schnorr sig
  const aggregate = new Uint8Array(64);
  aggregate.set(R_aggX, 0);
  aggregate.set(hexToBytes(s_aggHex), 32);

  return bytesToHex(aggregate);
}

// ============================================================================
// SECTION 3: L1 INSCRIPTION
// ============================================================================

export function buildFrostInscription(params: {
  type: 'C' | 'L' | 'R' | 'D';
  frostAddress: string;
  amountSompi: bigint;
  aggregatePubkey?: string;
}): Uint8Array {
  const { type, frostAddress, amountSompi, aggregatePubkey } = params;

  const addrHash = sha256(new TextEncoder().encode(frostAddress));
  const agreementHash = addrHash.slice(0, 8);

  const amountBytes = new Uint8Array(8);
  let amt = amountSompi;
  for (let i = 0; i < 8; i++) { amountBytes[i] = Number(amt & 0xffn); amt >>= 8n; }

  const prefix = new TextEncoder().encode(KVF_PREFIX + type);

  if (type === 'C' && aggregatePubkey) {
    const aggBytes = hexToBytes(aggregatePubkey.slice(0, 64));
    const payload = new Uint8Array(4 + 8 + 8 + 32);
    payload.set(prefix, 0);
    payload.set(agreementHash, 4);
    payload.set(amountBytes, 12);
    payload.set(aggBytes, 20);
    return payload;
  } else {
    const payload = new Uint8Array(4 + 8 + 8);
    payload.set(prefix, 0);
    payload.set(agreementHash, 4);
    payload.set(amountBytes, 12);
    return payload;
  }
}

export function parseFrostInscription(data: Uint8Array): FrostInscription | null {
  if (data.length < 20) return null;
  const prefix = new TextDecoder().decode(data.slice(0, 3));
  if (prefix !== KVF_PREFIX) return null;
  const typeChar = String.fromCharCode(data[3]);
  if (!['C', 'L', 'R', 'D'].includes(typeChar)) return null;

  const agreementHash = bytesToHex(data.slice(4, 12));
  let amountSompi = 0n;
  for (let i = 7; i >= 0; i--) amountSompi = (amountSompi << 8n) | BigInt(data[12 + i]);

  return {
    type: typeChar as 'C' | 'L' | 'R' | 'D',
    frostAddress: '',
    agreementHash,
    amountSompi,
  };
}

export async function inscribeFrostEvent(params: {
  type: 'C' | 'L' | 'R' | 'D';
  frostAddress: FrostAddress;
  amountSompi: bigint;
  privateKeyHex: string;
  senderAddress: string;
}): Promise<{ txId: string; explorerUrl: string }> {
  const { type, frostAddress, amountSompi, privateKeyHex, senderAddress } = params;

  const payload = buildFrostInscription({
    type,
    frostAddress: frostAddress.address,
    amountSompi,
    aggregatePubkey: type === 'C' ? frostAddress.aggregatedPubkey : undefined,
  });

  const { sendWithInscription } = await import('./kaspa_unified');

  const result = await sendWithInscription(
    senderAddress,
    senderAddress,
    546n,
    payload,
    privateKeyHex
  );

  const explorerBase = frostAddress.network === 'mainnet'
    ? 'https://explorer.kaspa.org/txs/'
    : 'https://explorer-tn10.kaspa.org/txs/';

  return { txId: result.txId, explorerUrl: explorerBase + result.txId };
}

// ============================================================================
// SECTION 4: PUBKEY EXCHANGE METHODS
// ============================================================================

export interface QRPayload {
  type: 'frost_pubkey';
  pubkey: string;
  name?: string;
  agreementId: string;
  network: KaspaNetwork;
}

export function generatePubkeyQR(params: {
  pubkey: string;
  name?: string;
  agreementId: string;
  network: KaspaNetwork;
}): string {
  const payload: QRPayload = { type: 'frost_pubkey', ...params };
  return JSON.stringify(payload);
}

export function parsePubkeyQR(data: string): QRPayload | null {
  try {
    const payload = JSON.parse(data);
    if (payload.type !== 'frost_pubkey' || !payload.pubkey) return null;
    return payload as QRPayload;
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------------------
// BLE
// ----------------------------------------------------------------------------

let bleManager: any = null;
let blePeripheral: any = null;

async function initBluetooth(): Promise<void> {
  if (bleManager) return;

  if (Platform.OS === 'android' && (Platform.Version as number) >= 31) {
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
    ]);
    if (!Object.values(granted).every(v => v === 'granted')) throw new Error('Bluetooth permissions denied');
  } else if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    if (granted !== 'granted') throw new Error('Location permission denied');
  }

  // BLE disabled � native modules not installed
  console.warn('[FROST] BLE disabled'); return;

  // blePeripheral disabled

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Bluetooth timeout')), 5000);
    const sub = bleManager.onStateChange((state: string) => {
      if (state === 'PoweredOn') { clearTimeout(timeout); sub.remove(); resolve(); }
      else if (state === 'PoweredOff') { clearTimeout(timeout); sub.remove(); reject(new Error('Bluetooth is off')); }
    }, true);
  });
}

export async function scanForBlePeers(
  timeoutMs = 15000,
  onProgress?: (p: ExchangeProgress) => void
): Promise<PeerInfo[]> {
  await initBluetooth();
  onProgress?.({ phase: 'scanning', progress: 10, message: 'Scanning for nearby devices...' });

  const peers = new Map<string, PeerInfo>();

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      bleManager.stopDeviceScan();
      resolve(Array.from(peers.values()).sort((a, b) => (b.rssi || -100) - (a.rssi || -100)));
    }, timeoutMs);

    bleManager.startDeviceScan([BLE_SERVICE_UUID], { allowDuplicates: false }, (error: any, device: any) => {
      if (error) {
        clearTimeout(timeout);
        bleManager.stopDeviceScan();
        reject(new Error(`Scan failed: ${error.message}`));
        return;
      }
      if (device?.manufacturerData) {
        try {
          const binary = atob(device.manufacturerData);
          if (binary.length >= 35) {
            const pubkey = bytesToHex(Uint8Array.from(binary.slice(2, 35), (c: string) => c.charCodeAt(0)));
            peers.set(device.id, {
              id: device.id,
              pubkey,
              name: device.localName || device.name || 'FROST Peer',
              method: 'ble',
              rssi: device.rssi,
            });
            onProgress?.({ phase: 'scanning', progress: 20 + Math.min(peers.size * 10, 60), message: `Found ${peers.size} peer(s)...` });
          }
        } catch {}
      }
    });
  });
}

export async function advertiseBleForFrost(
  myPubkey: string,
  onPeerConnected: (peer: PeerInfo) => void
): Promise<() => void> {
  await initBluetooth();
  if (!blePeripheral) throw new Error('BLE peripheral mode not supported on this device');

  const pubkeyBytes = hexToBytes(myPubkey);
  const mfgData = [0xFF, 0xFF, ...pubkeyBytes];

  await blePeripheral.addService(BLE_SERVICE_UUID, true);
  await blePeripheral.addCharacteristic(BLE_SERVICE_UUID, BLE_CHAR_PUBKEY_UUID, 16 | 2, 1);
  await blePeripheral.startAdvertising({ name: 'KasVillage FROST', serviceUuids: [BLE_SERVICE_UUID], manufacturerData: mfgData });

  blePeripheral.onWriteRequest((deviceId: string, charUuid: string, value: string) => {
    if (charUuid === BLE_CHAR_PUBKEY_UUID) {
      try {
        const theirPubkey = b64ToStr(value);
        onPeerConnected({ id: deviceId, pubkey: theirPubkey, method: 'ble' });
      } catch {}
    }
  });

  return () => blePeripheral?.stopAdvertising();
}

export async function exchangePubkeyViaBle(
  peer: PeerInfo,
  myPubkey: string,
  onProgress?: (p: ExchangeProgress) => void
): Promise<string> {
  await initBluetooth();
  onProgress?.({ phase: 'connecting', progress: 30, message: 'Connecting...' });

  const device = await bleManager.connectToDevice(peer.id, { requestMTU: 512 });

  try {
    await device.discoverAllServicesAndCharacteristics();
    onProgress?.({ phase: 'exchanging', progress: 50, message: 'Exchanging pubkeys...' });

    await device.writeCharacteristicWithResponseForService(BLE_SERVICE_UUID, BLE_CHAR_PUBKEY_UUID, strToB64(myPubkey));

    const char = await device.readCharacteristicForService(BLE_SERVICE_UUID, BLE_CHAR_PUBKEY_UUID);
    const theirPubkey = char?.value ? b64ToStr(char.value) : peer.pubkey;

    onProgress?.({ phase: 'complete', progress: 100, message: 'Exchange complete!' });
    return theirPubkey;
  } finally {
    await device.cancelConnection();
  }
}

// ----------------------------------------------------------------------------
// WiFi P2P
// ----------------------------------------------------------------------------

let wifiServer: any = null;

export async function getLocalIP(): Promise<string | null> {
  try { return await require('react-native-network-info').getIPV4Address(); } catch {}
  try {
    const state = await require('@react-native-community/netinfo').default.fetch();
    return state.details?.ipAddress || null;
  } catch {}
  return null;
}

export async function startWifiP2PServer(
  myPubkey: string,
  agreementId: string,
  onPeerConnected: (peer: PeerInfo) => void
): Promise<{ ip: string; port: number; stop: () => void }> {
  const ip = await getLocalIP();
  if (!ip) throw new Error('No local IP - not connected to WiFi');

  const httpBridge = require('react-native-http-bridge');

  httpBridge.start(FROST_P2P_PORT, 'FrostP2P', (req: any) => {
    if (req.url === '/frost/pubkey' && req.type === 'POST') {
      try {
        const body = JSON.parse(req.postData);
        onPeerConnected({ id: body.pubkey, pubkey: body.pubkey, name: body.name, method: 'wifi', ip: req.headers?.['x-forwarded-for'] || 'unknown' });
        httpBridge.respond(req.requestId, 200, 'application/json', JSON.stringify({ pubkey: myPubkey, agreementId }));
      } catch {
        httpBridge.respond(req.requestId, 400, 'text/plain', 'Invalid request');
      }
    } else if (req.url === '/frost/info') {
      httpBridge.respond(req.requestId, 200, 'application/json', JSON.stringify({ agreementId, pubkey: myPubkey }));
    } else {
      httpBridge.respond(req.requestId, 404, 'text/plain', 'Not found');
    }
  });

  wifiServer = httpBridge;
  return { ip, port: FROST_P2P_PORT, stop: () => { httpBridge.stop(); wifiServer = null; } };
}

export async function connectToWifiPeer(
  ip: string,
  port: number,
  myPubkey: string,
  myName?: string,
  onProgress?: (p: ExchangeProgress) => void
): Promise<PeerInfo> {
  onProgress?.({ phase: 'connecting', progress: 20, message: `Connecting to ${ip}...` });
  const response = await fetch(`http://${ip}:${port}/frost/pubkey`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pubkey: myPubkey, name: myName }),
  });
  if (!response.ok) throw new Error('Failed to connect');
  const data = await response.json();
  onProgress?.({ phase: 'complete', progress: 100, message: 'Connected!' });
  return { id: data.pubkey, pubkey: data.pubkey, method: 'wifi', ip };
}

// ----------------------------------------------------------------------------
// Tailscale
// ----------------------------------------------------------------------------

export async function getTailscaleIP(): Promise<string | null> {
  try {
    const ip = await getLocalIP();
    if (ip && ip.startsWith('100.') && parseInt(ip.split('.')[1]) >= 64) return ip;
    const resp = await fetch('http://100.100.100.100/localapi/v0/status');
    if (resp.ok) { const data = await resp.json(); return data?.Self?.TailscaleIPs?.[0] || null; }
  } catch {}
  return null;
}

export async function isTailscaleFunnelAvailable(): Promise<boolean> {
  const ip = await getTailscaleIP();
  if (!ip) return false;
  try { return (await fetch('http://100.100.100.100/localapi/v0/file-targets')).ok; } catch { return false; }
}

export async function startTailscaleFunnel(
  myPubkey: string,
  agreementId: string,
  onPeerConnected: (peer: PeerInfo) => void
): Promise<{ url: string; stop: () => void }> {
  const { ip, port, stop } = await startWifiP2PServer(myPubkey, agreementId, peer => onPeerConnected({ ...peer, method: 'tailscale' }));
  const tsIP = await getTailscaleIP();
  if (!tsIP) { stop(); throw new Error('Tailscale not connected'); }
  return { url: `http://${tsIP}:${port}/frost/info`, stop };
}

export function openTailscaleApp(): void {
  const scheme = Platform.OS === 'ios' ? 'tailscale://' : 'com.tailscale.ipn://';
  Linking.canOpenURL(scheme).then(can => {
    Linking.openURL(can ? scheme : Platform.select({
      ios: 'https://apps.apple.com/app/tailscale/id1470499037',
      android: 'https://play.google.com/store/apps/details?id=com.tailscale.ipn',
      default: 'https://tailscale.com/download',
    })!);
  });
}

// ----------------------------------------------------------------------------
// TownHall relay
// ----------------------------------------------------------------------------

export async function exchangeViaTownhall(params: {
  agreementId: string;
  myPubkey: string;
  network: KaspaNetwork;
  onProgress?: (p: ExchangeProgress) => void;
}): Promise<{ theirPubkey: string; frostAddress: FrostAddress } | null> {
  const { agreementId, myPubkey, network, onProgress } = params;
  onProgress?.({ phase: 'connecting', progress: 10, message: 'Connecting to TownHall...' });

  try {
    const initRes = await fetch(`${TOWNHALL_BASE}/api/frost/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agreement_id: agreementId, initiator_pubkey: myPubkey, network }),
    });
    if (!initRes.ok && initRes.status !== 409) throw new Error('TownHall connection failed');

    onProgress?.({ phase: 'exchanging', progress: 30, message: 'Waiting for counterparty...' });

    let theirPubkey: string | null = null;
    let attempts = 0;
    const maxAttempts = 60;

    while (!theirPubkey && attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 5000));
      const statusRes = await fetch(`${TOWNHALL_BASE}/api/frost/status/${agreementId}`);
      if (statusRes.ok) {
        const status = await statusRes.json();
        if (status.party_a_joined && status.party_b_joined) {
          theirPubkey = status.party_a_pubkey === myPubkey ? status.party_b_pubkey : status.party_a_pubkey;
        }
      }
      attempts++;
      onProgress?.({ phase: 'exchanging', progress: 30 + Math.min(attempts, 50), message: `Waiting... (${attempts * 5}s)` });
    }

    if (!theirPubkey) throw new Error('Timeout waiting for counterparty');

    onProgress?.({ phase: 'verifying', progress: 90, message: 'Deriving FROST address...' });
    const frostAddress = deriveFrostAddressLocal({ pubkeyA: myPubkey, pubkeyB: theirPubkey, network, agreementId });
    onProgress?.({ phase: 'complete', progress: 100, message: 'Complete!' });

    return { theirPubkey, frostAddress };
  } catch (e: any) {
    onProgress?.({ phase: 'error', progress: 0, message: e.message });
    return null;
  }
}

// ============================================================================
// SECTION 5: HIGH-LEVEL API
// ============================================================================

export async function exchangePubkeys(params: {
  method: ExchangeMethod;
  myPubkey: string;
  agreementId: string;
  network: KaspaNetwork;
  peer?: PeerInfo;
  targetIP?: string;
  qrData?: string;
  onProgress?: (p: ExchangeProgress) => void;
}): Promise<{ theirPubkey: string; frostAddress: FrostAddress; verificationCode: string }> {
  const { method, myPubkey, agreementId, network, peer, targetIP, qrData, onProgress } = params;
  let theirPubkey: string;

  switch (method) {
    case 'qr': {
      if (!qrData) throw new Error('QR data required');
      const qrPayload = parsePubkeyQR(qrData);
      if (!qrPayload) throw new Error('Invalid QR code');
      theirPubkey = qrPayload.pubkey;
      break;
    }
    case 'ble': {
      if (!peer) throw new Error('BLE peer required');
      theirPubkey = await exchangePubkeyViaBle(peer, myPubkey, onProgress);
      break;
    }
    case 'wifi': {
      if (targetIP) {
        theirPubkey = (await connectToWifiPeer(targetIP, FROST_P2P_PORT, myPubkey, undefined, onProgress)).pubkey;
      } else if (peer) {
        theirPubkey = peer.pubkey;
      } else {
        throw new Error('WiFi peer or target IP required');
      }
      break;
    }
    case 'tailscale': {
      if (!targetIP) throw new Error('Tailscale peer URL required');
      theirPubkey = (await connectToWifiPeer(targetIP, FROST_P2P_PORT, myPubkey, undefined, onProgress)).pubkey;
      break;
    }
    case 'townhall': {
      const result = await exchangeViaTownhall({ agreementId, myPubkey, network, onProgress });
      if (!result) throw new Error('TownHall exchange failed');
      return { theirPubkey: result.theirPubkey, frostAddress: result.frostAddress, verificationCode: result.frostAddress.verificationCode };
    }
    default:
      throw new Error(`Unknown method: ${method}`);
  }

  const frostAddress = deriveFrostAddressLocal({ pubkeyA: myPubkey, pubkeyB: theirPubkey, network, agreementId });
  return { theirPubkey, frostAddress, verificationCode: frostAddress.verificationCode };
}

export async function createFrostAgreement(params: {
  method: ExchangeMethod;
  myPubkey: string;
  myPrivateKey: string;
  myAddress: string;
  agreementId: string;
  network: KaspaNetwork;
  amountSompi: bigint;
  peer?: PeerInfo;
  targetIP?: string;
  qrData?: string;
  onProgress?: (p: ExchangeProgress) => void;
}): Promise<{ frostAddress: FrostAddress; verificationCode: string; inscriptionTxId: string }> {
  const { method, myPubkey, myPrivateKey, myAddress, agreementId, network, amountSompi, peer, targetIP, qrData, onProgress } = params;

  const { theirPubkey: _t, frostAddress, verificationCode } = await exchangePubkeys({ method, myPubkey, agreementId, network, peer, targetIP, qrData, onProgress });
  onProgress?.({ phase: 'verifying', progress: 80, message: 'Inscribing to L1...' });

  const inscription = await inscribeFrostEvent({ type: 'C', frostAddress, amountSompi, privateKeyHex: myPrivateKey, senderAddress: myAddress });
  onProgress?.({ phase: 'complete', progress: 100, message: 'FROST address created!' });

  return { frostAddress, verificationCode, inscriptionTxId: inscription.txId };
}

export async function createFrostPartialSig(params: {
  frostAddress: FrostAddress;
  recipientAddress?: string;
  amountSompi: bigint;
  privateKeyHex: string;
  useTownhall?: boolean;
  recipients?: Array<{ address: string; amount: bigint }>;
}): Promise<{ success: boolean; partialSig?: string; messageHash?: string; error?: string }> {
  const { frostAddress, recipientAddress, amountSompi, privateKeyHex, useTownhall = true } = params;

  try {
    const result = createPartialSigLocal({ frostAddress, recipientAddress, amountSompi, privateKeyHex });

    if (useTownhall) {
      try {
        await fetch(`${TOWNHALL_BASE}/api/frost/partial-sig`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: frostAddress.sessionId,
            pubkey: result.signerPubkey,
            partial_sig: result.partialSig,
            message_hash: result.messageHash,
            recipient_address: recipientAddress,
            amount_sompi: Number(amountSompi),
          }),
        });
      } catch (e) {
        console.warn('[FROST] TownHall relay failed (non-fatal):', e);
      }
    }

    return { success: true, partialSig: result.partialSig, messageHash: result.messageHash };
  } catch (e: any) {
    return { success: false, error: e.message || 'Partial sig creation failed' };
  }
}

export async function completeFrostAndBroadcast(params: {
  frostAddress: FrostAddress;
  myPrivateKeyHex: string;
  recipientAddress?: string;
  amountSompi: bigint;
  counterpartyPartialSig?: string;
  recipients?: Array<{ address: string; amount: bigint }>;
}): Promise<{ success: boolean; txId?: string; explorerUrl?: string; error?: string }> {
  const { frostAddress, myPrivateKeyHex, recipientAddress, amountSompi, counterpartyPartialSig } = params;

  try {
    const myResult = createPartialSigLocal({ frostAddress, recipientAddress, amountSompi, privateKeyHex: myPrivateKeyHex });
    let theirSig = counterpartyPartialSig;

    if (!theirSig) {
      // Submit my partial sig to TownHall and check for counterparty's
      try {
        const { submitPartialSig } = await import('./townhall_client');
        const sigResult = await submitPartialSig({
          agreementId: frostAddress.sessionId,
          pubkey: myResult.signerPubkey,
          partialSig: myResult.partialSig,
          recipientAddress,
        });
        console.log('[FROST] Partial sig submitted:', JSON.stringify(sigResult));
        if (sigResult.bothReady) {
          // Both partial sigs available — find the counterparty's
          const myPub = myResult.signerPubkey;
          if (sigResult.partialSigA && sigResult.partialSigB) {
            // Determine which is mine and which is theirs
            const agreementStatus = await (await import('./townhall_client')).getAgreementStatus(frostAddress.sessionId);
            if (agreementStatus) {
              theirSig = agreementStatus.partyA.pubkey === myPub 
                ? sigResult.partialSigB 
                : sigResult.partialSigA;
            }
          }
        }
      } catch (e) {
        console.warn('[FROST] TownHall partial sig exchange failed:', e);
      }
    }

    if (!theirSig) return { success: false, error: 'Counterparty signature not available yet' };

    const aggregateSig = aggregatePartialSigs(myResult.partialSig, theirSig);
    // Build and submit FROST release TX using aggregate Schnorr signature
    // No private key needed — the aggregate sig IS the authorization
    try {
      const { sendKaspaWithSignature } = await import('./kaspa_rest_tx');
      const result = await sendKaspaWithSignature({
        senderAddress: frostAddress.address,
        recipientAddress: (recipientAddress || '') as string,
        amountSompi,
        aggregateSignature: aggregateSig,
        aggregatePubkey: frostAddress.aggregatedPubkey,
        network: frostAddress.network,
        recipients: params.recipients,
      });
      if (!result.success) return { success: false, error: result.error || 'L1 broadcast failed' };
      const txId = result.txId || '';
      const explorerBase = frostAddress.network === 'mainnet' ? 'https://explorer.kaspa.org/txs/' : 'https://explorer-tn10.kaspa.org/txs/';
      return { success: true, txId, explorerUrl: explorerBase + txId };
    } catch (broadcastErr: any) {
      return { success: false, error: 'L1 broadcast failed: ' + broadcastErr.message };
    }
  } catch (e: any) {
    return { success: false, error: e.message || 'Broadcast failed' };
  }
}



// ============================================================================
// 2-ROUND FROST COMPLETION — uses proper nonce protocol
// ============================================================================
export async function completeFrost2Round(params: {
  frostAddress: FrostAddress;
  myPrivateKeyHex: string;
  recipientAddress: string;
  amountSompi: bigint;
  myNonceJson: string; // JSON stringified FrostNonce from AsyncStorage
  counterpartyR_hex: string;
  counterpartySig?: { R_agg_x_hex: string; s_hex: string };
  buyerAmountSompi?: bigint;
  sellerAmountSompi?: bigint;
  buyerAddress?: string;
  sellerAddress?: string;
}): Promise<{ success: boolean; txId?: string; explorerUrl?: string; error?: string }> {
  try {
    const myNonce: FrostNonce = JSON.parse(params.myNonceJson);
    
    // Compute my partial s
    const myPartial = computeFrostPartialS({
      myNonce,
      counterpartyR_hex: params.counterpartyR_hex,
      frostAddress: params.frostAddress,
    });
    
    if (params.counterpartySig) {
      // Multi-input FROST with real Kaspa sighashes
      const { buildCanonicalFrostTx, canonicalSighash, submitCanonicalFrostTx } = await import('./kaspa_rest_tx');
      const N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
      const cpAllS: string[] = [];
      let rawS = params.counterpartySig.s_hex;
      let txTemplate: any | undefined;
      // Extract TX template if packed with sig
      const pipeIdx = rawS.indexOf('|');
      if (pipeIdx > 0) {
        try { txTemplate = JSON.parse(atob(rawS.slice(pipeIdx + 1))); console.log('[FROST-Canonical-Seller] Got TX template:', txTemplate?.u?.length, 'inputs', txTemplate?.o?.length, 'outputs'); } catch {}
        rawS = rawS.slice(0, pipeIdx);
      }
      for (let si = 0; si < rawS.length; si += 64) { cpAllS.push(rawS.slice(si, si + 64)); }
      console.log('[FROST-2R] Buyer sent', cpAllS.length, 'partial s values');
      const R_agg_x_hex = myPartial.R_agg_x_hex;
      // Derive buyer/seller addresses from pubkeys
      const buyerPk = params.frostAddress.pubkeyA;
      const sellerPk = params.frostAddress.pubkeyB;
      const buyerAddr = aggregateToAddress('02' + (buyerPk.length === 66 ? buyerPk.slice(2) : buyerPk), params.frostAddress.network);
      const sellerAddr = aggregateToAddress('02' + (sellerPk.length === 66 ? sellerPk.slice(2) : sellerPk), params.frostAddress.network);
      // Determine which is buyer/seller based on recipientAddress
      // recipientAddress is the seller's wallet (seller gets paid)
      // But in canonical: buyer output first, seller output second
      // We need buyerAmountSompi and sellerAmountSompi ? derive from total
      // For now: buyer gets their collateral back, seller gets item price + their collateral
      // These must match what the buyer used ? passed via params
      const bAmt = params.buyerAmountSompi || 0n;
      const sAmt = params.sellerAmountSompi || 0n;
      console.log('[FROST-Canonical-Seller] buyer=', buyerAddr.slice(0,20), 'seller=', sellerAddr.slice(0,20), 'bAmt=', bAmt.toString(), 'sAmt=', sAmt.toString());
      let canonTx;
      if (txTemplate && txTemplate.u && txTemplate.o) {
        // Use buyer's exact TX template ? no derivation needed
        const { hexToBytes } = await import('@noble/hashes/utils');
        const utxos = txTemplate.u.map((u: any) => ({ outpoint: { transactionId: u.t, index: u.i }, utxoEntry: { amount: u.a, scriptPublicKey: { scriptPublicKey: u.s } } }));
        const inputs = utxos.map((u: any) => ({ txId: hexToBytes(u.outpoint.transactionId), index: u.outpoint.index, sequence: 0n, sigOpCount: 1, scriptVersion: 0, scriptPubKey: hexToBytes(u.utxoEntry.scriptPublicKey.scriptPublicKey), value: BigInt(u.utxoEntry.amount) }));
        const outputs = txTemplate.o.map((o: any) => ({ value: BigInt(o.v), scriptVersion: 0, script: hexToBytes(o.s) }));
        const fee = BigInt(txTemplate.f || '10000');
        let totalIn = 0n; for (const u of utxos) totalIn += BigInt(u.utxoEntry.amount);
        canonTx = { utxos, inputs, outputs, fee, totalIn };
        console.log('[FROST-Canonical-Seller] Using buyer TX template:', inputs.length, 'inputs', outputs.length, 'outputs');
        // VERIFY template matches agreement terms
        if (outputs.length >= 2) {
          const out0val = outputs[0].value;
          const out1val = outputs[1].value;
          const expectedBuyer = bAmt;
          const expectedSeller = sAmt;
          // Check output values match agreement (allow fee variance)
          const totalOut = out0val + out1val;
          const totalExpected = expectedBuyer + expectedSeller;
          if (totalOut > totalIn) { throw new Error('[FROST-Verify] Outputs exceed inputs: ' + totalOut.toString() + ' > ' + totalIn.toString()); }
          if (totalExpected > 0n && totalOut < totalExpected - 100000n) { throw new Error('[FROST-Verify] Output total too low: ' + totalOut.toString() + ' expected ~' + totalExpected.toString()); }
          // Check seller output contains seller's address script
          const myWalletPk = bytesToHex((secp as any).getPublicKey(hexToBytes(params.myPrivateKeyHex), true));
          const myXonly = myWalletPk.slice(2);
          const myScript = '20' + myXonly + 'ac';
          const out0script = bytesToHex(outputs[0].script);
          const out1script = bytesToHex(outputs[1].script);
          const myOutputIdx = out0script === myScript ? 0 : out1script === myScript ? 1 : -1;
          if (myOutputIdx === -1) { throw new Error('[FROST-Verify] No output pays to my address! Scripts: ' + out0script.slice(0,20) + ' / ' + out1script.slice(0,20) + ' expected: ' + myScript.slice(0,20)); }
          console.log('[FROST-Verify] Template OK: my output idx=' + myOutputIdx + ' value=' + outputs[myOutputIdx].value.toString() + ' total=' + totalOut.toString());
        }
      } else {
        canonTx = await buildCanonicalFrostTx({ frostAddress: params.frostAddress.address, buyerAddress: buyerAddr, sellerAddress: sellerAddr, buyerAmountSompi: bAmt, sellerAmountSompi: sAmt, network: params.frostAddress.network });
      }
      // Override sighashes with buyer's if available in template
      const buyerSighashes: string[] = txTemplate?.h || [];
      if (buyerSighashes.length > 0) { console.log('[FROST-Canonical-Seller] Using buyer sighashes from template:', buyerSighashes.length); }
      const result = await submitCanonicalFrostTx({
        tx: canonTx,
        buyerSighashes,
        perInputSigner: (sighashHex: string, inputIndex: number): string => {
          const myPartialN = computeFrostPartialS({ myNonce, counterpartyR_hex: params.counterpartyR_hex, frostAddress: params.frostAddress, sighash_hex: sighashHex });
          const mySN = BigInt('0x' + myPartialN.s_hex);
          const cpSN = cpAllS[inputIndex] ? BigInt('0x' + cpAllS[inputIndex]) : 0n;
          const s_agg = (mySN + cpSN) % N;
          const sigHex = R_agg_x_hex + s_agg.toString(16).padStart(64, '0');
          console.log('[FROST-Canonical] Input', inputIndex, ': myS=', mySN.toString(16).slice(0,16), 'cpS=', cpSN.toString(16).slice(0,16), 'agg=', s_agg.toString(16).slice(0,16));
          return sigHex;
        },
        network: params.frostAddress.network,
      });
      if (!result.success) return { success: false, error: result.error || 'L1 broadcast failed' };
      const explorerBase = params.frostAddress.network === 'mainnet' ? 'https://explorer.kaspa.org/txs/' : 'https://explorer-tn10.kaspa.org/txs/';
      return { success: true, txId: result.txId, explorerUrl: explorerBase + result.txId };
    }
    
    // Return our partial for relay
    return { success: true, partialSig: myPartial.s_hex, R_agg_x: myPartial.R_agg_x_hex } as any;
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ============================================================================
// SECTION 6: CLEANUP
// ============================================================================

export function cleanup(): void {
  try { bleManager?.stopDeviceScan(); bleManager?.destroy(); blePeripheral?.stopAdvertising(); wifiServer?.stop(); } catch {}
  bleManager = null; blePeripheral = null; wifiServer = null;
}

export default {
  deriveFrostAddressLocal, deriveAggregatePubkey, aggregateToAddress, generateVerificationCode, verifyFrostAddress,
  createPartialSigLocal, aggregatePartialSigs,
  buildFrostInscription, parseFrostInscription, inscribeFrostEvent,
  generatePubkeyQR, parsePubkeyQR, scanForBlePeers, advertiseBleForFrost, exchangePubkeyViaBle,
  startWifiP2PServer, connectToWifiPeer, getTailscaleIP, isTailscaleFunnelAvailable,
  startTailscaleFunnel, openTailscaleApp, exchangeViaTownhall,
  exchangePubkeys, createFrostAgreement, completeFrost2Round, cleanup,
};

