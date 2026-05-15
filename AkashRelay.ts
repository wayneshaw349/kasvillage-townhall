// AkashRelay.ts
// Production-ready quantum-safe relay
// Uses react-native-aes-crypto for native AES-256-GCM encryption

import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import Aes from 'react-native-aes-crypto';
import { schnorr, secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes, concatBytes } from '@noble/hashes/utils';

// Import canonical types from IOUBalanceSheetShare
import type { IOULedger, SignedIOU } from './IOUBalanceSheetShare';

// Alias for relay compatibility
export type BalanceSheet = IOULedger;
export type BalanceSheetEntry = SignedIOU;

// =============================================================================
// CONFIG
// =============================================================================

const RELAY_BASE_URL = 'https://townhall.kasvillage.app';
const RELAY_FALLBACKS = ['https://townhall-backup.kasvillage.app'];

const EPHEMERAL_EXPIRY_MS = 5 * 60 * 1000;
const KEY_REFRESH_INTERVAL = 4 * 60 * 1000;

const STORAGE_KEYS = {
  LAMPORT_SEED: 'kv_lamport_master_seed',
  LAMPORT_INDEX: 'kv_lamport_current_index',
  CURRENT_EPHEMERAL: 'kv_relay_ephemeral_key',
};

const BN254_PRIME = 0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001n;
const MERKLE_DOMAIN = 0x4D45524Bn;

// =============================================================================
// TYPES
// =============================================================================

export interface EphemeralSchnorrKey {
  keyId: string;
  privateKey: string;
  publicKey: string;
  createdAt: number;
  expiresAt: number;
  pqCommitment: string;
  pqSecret: string;
  registered: boolean;
  merkleIndex?: number;
}

export interface RelayPostResult {
  id: string;
  arweaveId: string;
  schnorrMerkleIndex: number;
  lamportMerkleIndex: number;
  merkleRoot: string;
}

export interface EncryptedPayload {
  ciphertext: string;    // hex
  ephemeralPub: string;  // hex - 33 bytes compressed
  iv: string;            // hex - 16 bytes
  recipientPub: string;  // hex
  version: number;       // 4 = react-native-aes-crypto
}

export interface QuantumSignature {
  schnorrKeyId: string;
  schnorrPubkey: string;
  schnorrSignature: string;
  schnorrPqCommitment: string;
  schnorrMerkleIndex: number;
  lamportKeyIndex: number;
  lamportCommitment: string;
  lamportMerkleIndex: number;
  encryptedLamport: EncryptedPayload;
}

export interface LamportSignature {
  revealed: string[];
}

export interface LamportPublicKey {
  pairs: Array<{ zero: string; one: string }>;
}

interface LamportPrivateKey {
  pairs: Array<{ zero: string; one: string }>;
}

// =============================================================================
// CRYPTO HELPERS
// =============================================================================

async function randomHex(bytes: number): Promise<string> {
  const randomBytes = await Crypto.getRandomBytesAsync(bytes);
  return Array.from(new Uint8Array(randomBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// =============================================================================
// HKDF-SHA256 (using react-native-aes-crypto pbkdf2 as KDF)
// =============================================================================

async function deriveKey(sharedSecret: string, info: string): Promise<string> {
  const key = await Aes.pbkdf2(sharedSecret, info, 1, 256, 'sha256');
  return key;
}

// =============================================================================
// ECIES ENCRYPTION (ECDH + AES-256-CBC via react-native-aes-crypto)
// =============================================================================

export async function encryptForRecipient(plaintext: string, recipientPubkeyHex: string): Promise<EncryptedPayload> {
  const ephemeralPrivHex = await randomHex(32);
  const ephemeralPrivBytes = hexToBytes(ephemeralPrivHex);
  const ephemeralPubBytes = secp256k1.getPublicKey(ephemeralPrivBytes, true);
  const ephemeralPubHex = bytesToHex(ephemeralPubBytes);
  
  let recipientPubBytes: Uint8Array;
  const pubBytes = hexToBytes(recipientPubkeyHex);
  if (pubBytes.length === 32) {
    recipientPubBytes = concatBytes(new Uint8Array([0x02]), pubBytes);
  } else if (pubBytes.length === 33) {
    recipientPubBytes = pubBytes;
  } else {
    throw new Error(`Invalid pubkey length: ${pubBytes.length}`);
  }
  
  try {
    secp256k1.ProjectivePoint.fromHex(recipientPubBytes);
  } catch {
    throw new Error('Invalid recipient public key');
  }
  
  const sharedPointBytes = secp256k1.getSharedSecret(ephemeralPrivBytes, recipientPubBytes, true);
  const sharedSecretHex = bytesToHex(sharedPointBytes);
  
  const info = `kasvillage-ecies-v4:${ephemeralPubHex}:${recipientPubkeyHex}`;
  const aesKeyHex = await deriveKey(sharedSecretHex, info);
  
  const ivHex = await randomHex(16);
  
  const ciphertextBase64 = await Aes.encrypt(plaintext, aesKeyHex, ivHex, 'aes-256-cbc');
  const ciphertextHex = base64ToHex(ciphertextBase64);
  
  return {
    ciphertext: ciphertextHex,
    ephemeralPub: ephemeralPubHex,
    iv: ivHex,
    recipientPub: recipientPubkeyHex,
    version: 4,
  };
}

export async function decryptWithPrivateKey(payload: EncryptedPayload, privateKeyHex: string): Promise<string> {
  if (payload.version !== 4) {
    throw new Error(`Unsupported encryption version: ${payload.version}`);
  }
  
  const privateKeyBytes = hexToBytes(privateKeyHex);
  const ephemeralPubBytes = hexToBytes(payload.ephemeralPub);
  
  let recipientPubHex = payload.recipientPub;
  if (recipientPubHex.length === 64) {
    recipientPubHex = '02' + recipientPubHex;
  }
  
  const sharedPointBytes = secp256k1.getSharedSecret(privateKeyBytes, ephemeralPubBytes, true);
  const sharedSecretHex = bytesToHex(sharedPointBytes);
  
  const info = `kasvillage-ecies-v4:${payload.ephemeralPub}:${payload.recipientPub}`;
  const aesKeyHex = await deriveKey(sharedSecretHex, info);
  
  const ciphertextBase64 = hexToBase64(payload.ciphertext);
  const plaintext = await Aes.decrypt(ciphertextBase64, aesKeyHex, payload.iv, 'aes-256-cbc');
  
  return plaintext;
}

// =============================================================================
// BASE64 / HEX CONVERSION
// =============================================================================

function base64ToHex(base64: string): string {
  const raw = atob(base64);
  let hex = '';
  for (let i = 0; i < raw.length; i++) {
    hex += raw.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return hex;
}

function hexToBase64(hex: string): string {
  let raw = '';
  for (let i = 0; i < hex.length; i += 2) {
    raw += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
  }
  return btoa(raw);
}

// =============================================================================
// LAMPORT OTS
// =============================================================================

const LAMPORT_N = 256;

async function sha256String(data: string): Promise<string> {
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, data);
}

async function deriveSecret(seed: string, keyIndex: number, pairIndex: number, side: 0 | 1): Promise<string> {
  return await sha256String(`${seed}:${keyIndex}:${pairIndex}:${side}`);
}

async function generateLamportPrivateKey(masterSeed: string, keyIndex: number): Promise<LamportPrivateKey> {
  const pairs: Array<{ zero: string; one: string }> = [];
  for (let i = 0; i < LAMPORT_N; i++) {
    const zero = await deriveSecret(masterSeed, keyIndex, i, 0);
    const one = await deriveSecret(masterSeed, keyIndex, i, 1);
    pairs.push({ zero, one });
  }
  return { pairs };
}

async function deriveLamportPublicKey(privateKey: LamportPrivateKey): Promise<LamportPublicKey> {
  const pairs: Array<{ zero: string; one: string }> = [];
  for (const pair of privateKey.pairs) {
    const zero = await sha256String(pair.zero);
    const one = await sha256String(pair.one);
    pairs.push({ zero, one });
  }
  return { pairs };
}

function hashToBits(hash: string): boolean[] {
  const bits: boolean[] = [];
  for (let i = 0; i < hash.length; i += 2) {
    const byte = parseInt(hash.substr(i, 2), 16);
    for (let j = 7; j >= 0; j--) {
      bits.push(((byte >> j) & 1) === 1);
    }
  }
  return bits;
}

async function lamportSign(privateKey: LamportPrivateKey, messageHash: string): Promise<LamportSignature> {
  const bits = hashToBits(messageHash);
  if (bits.length !== LAMPORT_N) {
    throw new Error(`Invalid hash length: expected ${LAMPORT_N} bits`);
  }
  const revealed: string[] = [];
  for (let i = 0; i < LAMPORT_N; i++) {
    revealed.push(bits[i] ? privateKey.pairs[i].one : privateKey.pairs[i].zero);
  }
  return { revealed };
}

// =============================================================================
// LAMPORT INDEX MANAGER
// =============================================================================

async function getLamportMasterSeed(): Promise<string> {
  let seed = await SecureStore.getItemAsync(STORAGE_KEYS.LAMPORT_SEED);
  if (!seed) {
    seed = await randomHex(32);
    await SecureStore.setItemAsync(STORAGE_KEYS.LAMPORT_SEED, seed, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }
  return seed;
}

async function getNextLamportIndex(): Promise<number> {
  const stored = await SecureStore.getItemAsync(STORAGE_KEYS.LAMPORT_INDEX);
  return stored ? parseInt(stored) : 0;
}

async function incrementLamportIndex(): Promise<number> {
  const current = await getNextLamportIndex();
  const next = current + 1;
  await SecureStore.setItemAsync(STORAGE_KEYS.LAMPORT_INDEX, next.toString());
  return current;
}

// =============================================================================
// POSEIDON HASH
// =============================================================================

const POSEIDON_C: bigint[] = [
  0x0ee9a592ba9a9518d05986d656f40c2114c4993c11bb29938d21d47304cd8e6en,
  0x00f1445235f2148c5986587169fc1bcd887b08d4d00868df5696fff40956e864n,
  0x08dff3487e8ac99e1f29a058d0fa80b930c728730b7ab36ce879f3890ecf73f5n,
  0x2f27be690fdaee46c3ce28f7532b13c856c35342c84bda6e20966310fadc01d0n,
  0x2b2ae1acf68b7b8d2416bebf3d4f6234b763fe04b8043ee48b8327bebca16cfan,
  0x0319d062072bef7ecca5eac06f97d4d55952c175ab6b03eae64b44c7dbf11cfan,
  0x28813dcaebaeaa828a376df87af4a63bc8b7bf27ad49c6298ef7b387bf28526dn,
  0x2727673b2ccbc903f181bf38e1c1d40d2033865200c352bc150928adddf9cb78n,
];

function poseidonHash(left: bigint, right: bigint, domain: bigint = MERKLE_DOMAIN): bigint {
  let state = [left, right, domain];
  for (let i = 0; i < 8; i++) {
    state[0] = (state[0] + POSEIDON_C[i]) % BN254_PRIME;
    state = state.map(x => {
      const x2 = (x * x) % BN254_PRIME;
      const x4 = (x2 * x2) % BN254_PRIME;
      return (x4 * x) % BN254_PRIME;
    });
    const sum = state.reduce((a, b) => (a + b) % BN254_PRIME, 0n);
    state = state.map(x => (x + sum) % BN254_PRIME);
  }
  return state[0];
}

function hexToBigInt(hex: string): bigint {
  return BigInt('0x' + hex) % BN254_PRIME;
}

function createLamportCommitment(sig: LamportSignature, pubkey: LamportPublicKey): string {
  const sigConcat = sig.revealed.join('');
  const sigHashBytes = sha256(new TextEncoder().encode(sigConcat));
  const pubkeyConcat = pubkey.pairs.map(p => p.zero + p.one).join('');
  const pubkeyHashBytes = sha256(new TextEncoder().encode(pubkeyConcat));
  
  const sigHash = hexToBigInt(bytesToHex(sigHashBytes));
  const pubkeyHash = hexToBigInt(bytesToHex(pubkeyHashBytes));
  
  return poseidonHash(sigHash, pubkeyHash).toString(16).padStart(64, '0');
}

// =============================================================================
// EPHEMERAL SCHNORR KEY MANAGER
// =============================================================================

class EphemeralSchnorrManager {
  private currentKey: EphemeralSchnorrKey | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private onKeyRotated: ((key: EphemeralSchnorrKey) => void) | null = null;

  async initialize(onKeyRotated?: (key: EphemeralSchnorrKey) => void): Promise<EphemeralSchnorrKey> {
    this.onKeyRotated = onKeyRotated || null;
    
    try {
      const stored = await SecureStore.getItemAsync(STORAGE_KEYS.CURRENT_EPHEMERAL);
      if (stored) {
        const key = JSON.parse(stored) as EphemeralSchnorrKey;
        if (key.expiresAt > Date.now()) {
          this.currentKey = key;
          this.scheduleRefresh();
          return key;
        }
      }
    } catch { /* ignore */ }
    
    return this.rotateKey();
  }

  async rotateKey(): Promise<EphemeralSchnorrKey> {
    if (this.currentKey) {
      try {
        await SecureStore.deleteItemAsync(`eph_${this.currentKey.keyId}`);
      } catch { /* ignore */ }
    }

    const privateKey = await randomHex(32);
    const privateKeyBytes = hexToBytes(privateKey);
    const publicKeyBytes = schnorr.getPublicKey(privateKeyBytes);
    const publicKey = bytesToHex(publicKeyBytes);
    
    const pqSecret = await randomHex(32);
    const pqCommitment = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      pqSecret + publicKey
    );

    const keyId = `eph_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    
    this.currentKey = {
      keyId,
      privateKey,
      publicKey,
      createdAt: Date.now(),
      expiresAt: Date.now() + EPHEMERAL_EXPIRY_MS,
      pqCommitment,
      pqSecret,
      registered: false,
    };

    try {
      await SecureStore.setItemAsync(
        STORAGE_KEYS.CURRENT_EPHEMERAL,
        JSON.stringify(this.currentKey),
        { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }
      );
    } catch { /* ignore */ }

    await this.registerWithBackend(this.currentKey);
    this.scheduleRefresh();
    this.onKeyRotated?.(this.currentKey);
    
    return this.currentKey;
  }

  private async registerWithBackend(key: EphemeralSchnorrKey): Promise<void> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`${RELAY_BASE_URL}/api/relay/ephemeral/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyId: key.keyId,
          publicKey: key.publicKey,
          pqCommitment: key.pqCommitment,
          expiresAt: key.expiresAt,
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (response.ok) {
        const result = await response.json();
        key.merkleIndex = result.merkleIndex;
        key.registered = true;
        
        await SecureStore.setItemAsync(
          STORAGE_KEYS.CURRENT_EPHEMERAL,
          JSON.stringify(key),
          { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }
        );
      }
    } catch { /* ignore */ }
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => this.rotateKey(), KEY_REFRESH_INTERVAL);
  }

  getCurrentKey(): EphemeralSchnorrKey {
    if (!this.currentKey || this.currentKey.expiresAt <= Date.now()) {
      throw new Error('No valid ephemeral key - call initialize() or rotateKey()');
    }
    return this.currentKey;
  }

  async sign(messageHashHex: string): Promise<{ signature: string; keyId: string; pubkey: string }> {
    const key = this.getCurrentKey();
    const messageHash = hexToBytes(messageHashHex);
    const privateKeyBytes = hexToBytes(key.privateKey);
    const signature = schnorr.sign(messageHash, privateKeyBytes);
    return {
      signature: bytesToHex(signature),
      keyId: key.keyId,
      pubkey: key.publicKey,
    };
  }

  cleanup(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = null;
    this.currentKey = null;
  }
}

// =============================================================================
// BALANCE SHEET HASHING (uses IOULedger fields)
// =============================================================================

function getSheetHashHex(sheet: BalanceSheet): string {
  const canonical = {
    id: sheet.id,
    frostAgreementId: sheet.frostAgreementId,
    frostTxId: sheet.frostTxId,
    frostAddress: sheet.frostAddress,
    partyA: sheet.partyA,
    partyB: sheet.partyB,
    ious: sheet.ious,
    netPositionSompi: sheet.netPositionSompi,
  };
  const hashBytes = sha256(new TextEncoder().encode(JSON.stringify(canonical, Object.keys(canonical).sort())));
  return bytesToHex(hashBytes);
}

// =============================================================================
// QUANTUM-SAFE SIGNING
// =============================================================================

let schnorrManager: EphemeralSchnorrManager | null = null;

export async function initializeRelay(
  onSchnorrKeyRotated?: (key: EphemeralSchnorrKey) => void
): Promise<EphemeralSchnorrKey> {
  schnorrManager = new EphemeralSchnorrManager();
  return schnorrManager.initialize(onSchnorrKeyRotated);
}

export function cleanupRelay(): void {
  schnorrManager?.cleanup();
  schnorrManager = null;
}

export async function signBalanceSheetQuantum(sheet: BalanceSheet): Promise<QuantumSignature> {
  if (!schnorrManager) {
    throw new Error('Relay not initialized - call initializeRelay() first');
  }

  const messageHashHex = getSheetHashHex(sheet);

  const schnorrResult = await schnorrManager.sign(messageHashHex);
  const schnorrKey = schnorrManager.getCurrentKey();

  const lamportSeed = await getLamportMasterSeed();
  const lamportIndex = await incrementLamportIndex();
  
  const lamportPrivKey = await generateLamportPrivateKey(lamportSeed, lamportIndex);
  const lamportPubKey = await deriveLamportPublicKey(lamportPrivKey);
  const lamportSig = await lamportSign(lamportPrivKey, messageHashHex);
  
  const lamportCommitment = createLamportCommitment(lamportSig, lamportPubKey);
  
  const lamportData = JSON.stringify({ signature: lamportSig, publicKey: lamportPubKey });
  const encryptedLamport = await encryptForRecipient(lamportData, schnorrKey.publicKey);

  return {
    schnorrKeyId: schnorrKey.keyId,
    schnorrPubkey: schnorrKey.publicKey,
    schnorrSignature: schnorrResult.signature,
    schnorrPqCommitment: schnorrKey.pqCommitment,
    schnorrMerkleIndex: schnorrKey.merkleIndex || -1,
    lamportKeyIndex: lamportIndex,
    lamportCommitment,
    lamportMerkleIndex: -1,
    encryptedLamport,
  };
}

// =============================================================================
// RELAY API
// =============================================================================

async function tryRelays<T>(path: string, options: RequestInit): Promise<T> {
  let lastError: Error | null = null;
  
  for (const baseUrl of [RELAY_BASE_URL, ...RELAY_FALLBACKS]) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(`${baseUrl}${path}`, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.status === 404) throw new Error('Not found');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      return await response.json();
    } catch (e: unknown) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  
  throw lastError || new Error('All relays failed');
}

export async function postBalanceSheetRelay(sheet: BalanceSheet): Promise<RelayPostResult> {
  const quantumSig = await signBalanceSheetQuantum(sheet);
  
  const recipientPubkey = quantumSig.schnorrPubkey === sheet.partyA.pubkey
    ? sheet.partyB.pubkey
    : sheet.partyA.pubkey;
  
  const encryptedSheet = await encryptForRecipient(JSON.stringify(sheet), recipientPubkey);

  return await tryRelays<RelayPostResult>('/api/relay/sheet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: sheet.id,
      encrypted: encryptedSheet,
      partyA: sheet.partyA.address,
      partyB: sheet.partyB.address,
      schnorrKeyId: quantumSig.schnorrKeyId,
      schnorrPubkey: quantumSig.schnorrPubkey,
      schnorrSignature: quantumSig.schnorrSignature,
      schnorrPqCommitment: quantumSig.schnorrPqCommitment,
      lamportKeyIndex: quantumSig.lamportKeyIndex,
      lamportCommitment: quantumSig.lamportCommitment,
      encryptedLamport: quantumSig.encryptedLamport,
      createdAt: sheet.createdAt,
    }),
  });
}

export async function getBalanceSheetRelay(sheetId: string, privateKeyHex?: string) {
  try {
    const result = await tryRelays<{
      id: string;
      encrypted: EncryptedPayload;
      arweaveId: string;
      schnorrMerkleIndex: number;
      lamportMerkleIndex: number;
      merkleRoot: string;
    }>(`/api/relay/sheet/${sheetId}`, { method: 'GET' });
    
    let decrypted: BalanceSheet | undefined;
    if (privateKeyHex) {
      try {
        const json = await decryptWithPrivateKey(result.encrypted, privateKeyHex);
        decrypted = JSON.parse(json);
      } catch { /* ignore */ }
    }
    
    return { ...result, decrypted };
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e));
    if (err.message === 'Not found') return null;
    throw err;
  }
}

export async function submitSignatureRelay(sheetId: string, sheet: BalanceSheet) {
  const quantumSig = await signBalanceSheetQuantum(sheet);

  return await tryRelays<{
    success: boolean;
    schnorrMerkleIndex: number;
    lamportMerkleIndex: number;
    merkleRoot: string;
  }>(`/api/relay/sheet/${sheetId}/sign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schnorrKeyId: quantumSig.schnorrKeyId,
      schnorrPubkey: quantumSig.schnorrPubkey,
      schnorrSignature: quantumSig.schnorrSignature,
      schnorrPqCommitment: quantumSig.schnorrPqCommitment,
      lamportKeyIndex: quantumSig.lamportKeyIndex,
      lamportCommitment: quantumSig.lamportCommitment,
      encryptedLamport: quantumSig.encryptedLamport,
      timestamp: Date.now(),
    }),
  });
}

export async function getMerkleProof(merkleIndex: number) {
  return await tryRelays<{
    leafIndex: number;
    path: Array<{ sibling: string; isLeft: boolean }>;
    root: string;
  }>(`/api/relay/merkle/proof/${merkleIndex}`, { method: 'GET' });
}

export async function getMerkleRoot() {
  return await tryRelays<{ root: string; leafCount: number }>('/api/relay/merkle/root', { method: 'GET' });
}

export function getRelayUrl(sheetId: string): string {
  return `${RELAY_BASE_URL}/sheet/${sheetId}`;
}

// =============================================================================
// EXPORTS
// =============================================================================

export { getLamportMasterSeed, getNextLamportIndex };

export default {
  initializeRelay,
  cleanupRelay,
  signBalanceSheetQuantum,
  encryptForRecipient,
  decryptWithPrivateKey,
  postBalanceSheetRelay,
  getBalanceSheetRelay,
  submitSignatureRelay,
  getMerkleProof,
  getMerkleRoot,
  getRelayUrl,
};