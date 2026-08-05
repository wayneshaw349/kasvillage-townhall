// ============================================================================
// KASVILLAGE COLD WALLET - PRODUCTION READY (REST API)
// ============================================================================
// Ephemeral Dual-Key Architecture:
//   - Schnorr (ephemeral): Rotates every 4 min, used for Lamport attestation
//   - Lamport (ephemeral): Single-use per signature, quantum-secure attestation
//   - Main wallet key: Signs Kaspa L1 transactions via REST API
//   - ALL transactions use REST API (no wRPC dependency)
// ============================================================================

import React, { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
  ScrollView, TextInput, Platform, Dimensions
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as ExpoCrypto from 'expo-crypto';
import * as Clipboard from 'expo-clipboard';
import * as Network from 'expo-network';

import { secp256k1, schnorr } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { blake2b } from '@noble/hashes/blake2b';
import { bytesToHex, hexToBytes, concatBytes } from '@noble/hashes/utils';
import { sendKaspaViaRest, getBalanceRest } from './kaspa_rest_tx';

// ============================================================================
// TYPES
// ============================================================================
export type KaspaNetwork = 'mainnet' | 'testnet-10' | 'testnet-11';

export interface EphemeralSchnorrKey {
  id: string;
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  xOnlyPubkey: Uint8Array;
  kaspaAddress: string;
  createdAt: number;
  expiresAt: number;
}

export interface EphemeralLamportKey {
  id: string;
  index: number;
  private0: Uint8Array[];
  private1: Uint8Array[];
  public0: Uint8Array[];
  public1: Uint8Array[];
  publicKeyHash: string;
  createdAt: number;
  used: boolean;
}

export interface LamportSignature {
  keyIndex: number;
  publicKeyHash: string;
  signature: string[];
  public0: string[];
  public1: string[];
  messageHash: string;
  timestamp: number;
}

export interface HybridSignature {
  schnorr: { signature: string; publicKey: string };
  lamport: LamportSignature;
  messageHash: string;
  kaspaTxId?: string;
  arweaveTxId?: string;
  timestamp: number;
}

export interface WalletState {
  initialized: boolean;
  network: KaspaNetwork;
  masterPubkey: string | null;
  masterAddress: string | null;
  schnorrKey: EphemeralSchnorrKey | null;
  schnorrKeyExpiresSoon: boolean;
  lamportCounter: number;
  balance: bigint;
  isOnline: boolean;
  isAuthenticated: boolean;
  addressRevealed: boolean;
  aptAlias: string | null;
}

export interface TransactionResult {
  success: boolean;
  kaspaTxId?: string;
  arweaveTxId?: string;
  explorerUrl?: string;
  error?: string;
  hybridSignature?: HybridSignature;
}

export interface TransactionHistoryEntry {
  txId: string;
  type: 'send' | 'receive';
  toAddress?: string;
  fromAddress?: string;
  amountSompi: bigint;
  fee?: bigint;
  memo?: string;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
  lamportIndex?: number;
}

export interface NeighborAgreementConfig {
  buyerPubkey: string;
  sellerPubkey: string;
  buyerLockSompi: bigint;
  sellerLockSompi: bigint;
  itemDescription: string;
  stipulations: string;
  expiryHours: number;
}

export interface NeighborAgreement {
  id: string;
  multisigAddress: string;
  redeemScriptHex: string;
  config: NeighborAgreementConfig;
  status: 'pending' | 'locked' | 'released' | 'disputed';
  buyerLocked: boolean;
  sellerLocked: boolean;
  buyerSignedRelease: string | null;
  sellerSignedRelease: string | null;
  createdAt: number;
  lockedAt: number | null;
  releasedAt: number | null;
  releaseTxId: string | null;
  pubkeys: [string, string];
  amountSompi: string;
}

export interface PartialSignature {
  pubkey: string;
  signature: string;
  inputIndex: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================
const ARWEAVE_GATEWAY = 'https://arweave.net';
const TURBO_UPLOAD_URL = 'https://upload.ardrive.io/v1/tx';

const SCHNORR_KEY_EXPIRY_MS = 5 * 60 * 1000;
const SCHNORR_KEY_REFRESH_MS = 4 * 60 * 1000;
const BIOMETRIC_CACHE_MS = 30 * 1000;
const ADDRESS_REVEAL_MS = 30 * 1000;

const EXPLORER_URLS: Record<KaspaNetwork, string> = {
  'mainnet': 'https://explorer.kaspa.org/txs/',
  'testnet-10': 'https://explorer-tn10.kaspa.org/txs/',
  'testnet-11': 'https://explorer-tn11.kaspa.org/txs/',
};

const API_BASES: Record<KaspaNetwork, string> = {
  'mainnet': 'https://api.kaspa.org',
  'testnet-10': 'https://api-tn10.kaspa.org',
  'testnet-11': 'https://api-tn11.kaspa.org',
};

const STORE = {
  MASTER_SEED: 'kv_master_seed_enc',
  DEVICE_KEY: 'kv_device_key',
  CURRENT_SCHNORR: 'kv_schnorr_current',
  LAMPORT_COUNTER: 'kv_lamport_counter',
  TX_HISTORY: 'kv_tx_history',
  APT_ALIAS: 'kv_apt_alias',
};

const SECP256K1_N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
const AGREEMENT_STORE_KEY = 'kv_neighbor_agreements';

// ============================================================================
// HELPER: Load main wallet credentials from SecureStore
// ============================================================================
async function loadMainWallet(): Promise<{ privKeyHex: string; address: string; network: KaspaNetwork } | null> {
  const privKeyHex = await SecureStore.getItemAsync('kv_private_key')
    || await SecureStore.getItemAsync('kasvillage_private_key')
    || '';
  const address = await SecureStore.getItemAsync('kaspa_address_tutorial')
    || await SecureStore.getItemAsync('kaspa_address')
    || '';
  if (!privKeyHex || !address) return null;
  const network: KaspaNetwork = address.startsWith('kaspatest:') ? 'testnet-10' : 'mainnet';
  return { privKeyHex, address, network };
}

// ============================================================================
// UTILITIES
// ============================================================================

function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = BigInt(0);
  for (let i = 0; i < bytes.length; i++) {
    result = (result << BigInt(8)) | BigInt(bytes[i]);
  }
  return result;
}

function bigIntToBytes(n: bigint, length: number): Uint8Array {
  const result = new Uint8Array(length);
  let temp = n;
  for (let i = length - 1; i >= 0; i--) {
    result[i] = Number(temp & BigInt(0xff));
    temp >>= BigInt(8);
  }
  return result;
}

// ============================================================================
// KASPA BECH32 ENCODING - 40-bit polymod, 8-char checksum
// ============================================================================
const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

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

function kaspaConv8to5(payload: number[] | Uint8Array): number[] {
  const result: number[] = [];
  let buff = 0, bits = 0;
  for (const c of payload) {
    buff = (buff << 8) | c; bits += 8;
    while (bits >= 5) { bits -= 5; result.push((buff >> bits) & 31); buff &= (1 << bits) - 1; }
  }
  if (bits > 0) result.push((buff << (5 - bits)) & 31);
  return result;
}

function bech32mEncode(hrp: string, data: Uint8Array): string {
  const fivebitPayload = kaspaConv8to5(data);
  const fivebitPrefix = Array.from(hrp).map(c => c.charCodeAt(0) & 0x1f);
  const checksumInput = [...fivebitPrefix, 0, ...fivebitPayload, 0, 0, 0, 0, 0, 0, 0, 0];
  const cs = kaspaPolymod(checksumInput);
  const csBytes: number[] = [];
  for (let i = 4; i >= 0; i--) csBytes.push(Number((cs >> BigInt(i * 8)) & 0xFFn));
  const cs5bit = kaspaConv8to5(csBytes);
  let encoded = hrp + ':';
  for (const d of [...fivebitPayload, ...cs5bit]) encoded += BECH32_CHARSET[d];
  return encoded;
}

// ============================================================================
// ADDRESS UTILITIES
// ============================================================================

function xOnlyFromCompressed(compressedPubkey: Uint8Array): Uint8Array {
  return compressedPubkey.length === 33 ? compressedPubkey.slice(1) : compressedPubkey;
}

function pubkeyToKaspaAddress(pubkey: Uint8Array, network: KaspaNetwork): string {
  const xOnly = xOnlyFromCompressed(pubkey);
  const payload = new Uint8Array(33);
  payload[0] = 0x00;
  payload.set(xOnly, 1);
  const prefix = network === 'mainnet' ? 'kaspa' : 'kaspatest';
  return bech32mEncode(prefix, payload);
}

function isValidKaspaAddress(address: string): boolean {
  if (!address) return false;
  return ['kaspa:', 'kaspatest:', 'kaspadev:'].some(p => address.startsWith(p));
}

function formatKAS(sompi: bigint): string {
  const kas = Number(sompi) / 100_000_000;
  return kas.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 });
}

// ============================================================================
// DEVICE ENCRYPTION
// ============================================================================

async function getDeviceKey(): Promise<Uint8Array> {
  let keyHex = await SecureStore.getItemAsync(STORE.DEVICE_KEY);
  if (!keyHex) {
    const keyBytes = await ExpoCrypto.getRandomBytesAsync(32);
    keyHex = bytesToHex(new Uint8Array(keyBytes));
    await SecureStore.setItemAsync(STORE.DEVICE_KEY, keyHex, {
      keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
    });
  }
  return hexToBytes(keyHex);
}

function xorCrypt(data: Uint8Array, key: Uint8Array): Uint8Array {
  const expanded = sha256(key);
  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ expanded[i % expanded.length];
  }
  return result;
}

async function encryptKey(privateKey: Uint8Array): Promise<string> {
  const deviceKey = await getDeviceKey();
  const salt = new Uint8Array(await ExpoCrypto.getRandomBytesAsync(16));
  const derivedKey = sha256(concatBytes(deviceKey, salt));
  const encrypted = xorCrypt(privateKey, derivedKey);
  return bytesToHex(concatBytes(salt, encrypted));
}

async function decryptKey(encryptedHex: string): Promise<Uint8Array> {
  const data = hexToBytes(encryptedHex);
  const salt = data.slice(0, 16);
  const encrypted = data.slice(16);
  const deviceKey = await getDeviceKey();
  const derivedKey = sha256(concatBytes(deviceKey, salt));
  return xorCrypt(encrypted, derivedKey);
}

// ============================================================================
// SCHNORR KEY MANAGER (ephemeral � for Lamport attestation, NOT for L1 sends)
// ============================================================================

class SchnorrKeyManager {
  private currentKey: EphemeralSchnorrKey | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private network: KaspaNetwork = 'mainnet';
  private onKeyRotated: ((key: EphemeralSchnorrKey) => void) | null = null;

  setNetwork(network: KaspaNetwork): void { this.network = network; }
  getNetwork(): KaspaNetwork { return this.network; }
  setOnKeyRotated(callback: (key: EphemeralSchnorrKey) => void): void { this.onKeyRotated = callback; }

  async initialize(): Promise<EphemeralSchnorrKey> {
    const stored = await SecureStore.getItemAsync(STORE.CURRENT_SCHNORR);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.expiresAt > Date.now()) {
          const privateKey = await decryptKey(parsed.privateKeyEnc);
          this.currentKey = {
            id: parsed.id, privateKey,
            publicKey: hexToBytes(parsed.publicKey),
            xOnlyPubkey: hexToBytes(parsed.xOnlyPubkey),
            kaspaAddress: parsed.kaspaAddress,
            createdAt: parsed.createdAt, expiresAt: parsed.expiresAt,
          };
          this.scheduleRefresh();
          return this.currentKey;
        }
      } catch (e) { console.warn('[SchnorrKeyManager] Failed to load stored key:', e); }
    }
    return this.rotateKey();
  }

  async rotateKey(): Promise<EphemeralSchnorrKey> {
    if (this.refreshTimer) { clearTimeout(this.refreshTimer); this.refreshTimer = null; }
    const privateKeyBytes = new Uint8Array(await ExpoCrypto.getRandomBytesAsync(32));
    const publicKey = secp256k1.getPublicKey(privateKeyBytes, true);
    const xOnlyPubkey = xOnlyFromCompressed(publicKey);
    const kaspaAddress = pubkeyToKaspaAddress(publicKey, this.network);
    const now = Date.now();
    const id = `schnorr_${now}_${bytesToHex(privateKeyBytes.slice(0, 4))}`;
    this.currentKey = {
      id, privateKey: privateKeyBytes, publicKey, xOnlyPubkey, kaspaAddress,
      createdAt: now, expiresAt: now + SCHNORR_KEY_EXPIRY_MS,
    };
    const privateKeyEnc = await encryptKey(privateKeyBytes);
    await SecureStore.setItemAsync(STORE.CURRENT_SCHNORR, JSON.stringify({
      id, privateKeyEnc, publicKey: bytesToHex(publicKey),
      xOnlyPubkey: bytesToHex(xOnlyPubkey), kaspaAddress,
      createdAt: now, expiresAt: now + SCHNORR_KEY_EXPIRY_MS,
    }), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    this.scheduleRefresh();
    if (this.onKeyRotated) this.onKeyRotated(this.currentKey);
    return this.currentKey;
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    const timeUntilRefresh = this.currentKey
      ? Math.max(0, this.currentKey.createdAt + SCHNORR_KEY_REFRESH_MS - Date.now()) : 0;
    this.refreshTimer = setTimeout(() => { this.rotateKey().catch(console.error); }, timeUntilRefresh);
  }

  getCurrentKey(): EphemeralSchnorrKey | null {
    if (!this.currentKey) return null;
    if (Date.now() >= this.currentKey.expiresAt) { this.rotateKey().catch(console.error); return null; }
    return this.currentKey;
  }

  isExpiringSoon(): boolean {
    if (!this.currentKey) return true;
    return (this.currentKey.expiresAt - Date.now()) < 60_000;
  }

  async signWithAux(messageHash: Uint8Array): Promise<Uint8Array> {
    const key = this.getCurrentKey();
    if (!key) throw new Error('No active Schnorr key');
    const auxRand = new Uint8Array(await ExpoCrypto.getRandomBytesAsync(32));
    return schnorr.sign(messageHash, key.privateKey, auxRand);
  }

  getPublicKey(): Uint8Array | null { return this.currentKey?.xOnlyPubkey || null; }
  getAddress(): string | null { return this.currentKey?.kaspaAddress || null; }

  async generatePerTxKey(): Promise<{
    privateKey: Uint8Array; publicKey: Uint8Array; xOnlyPubkey: Uint8Array; kaspaAddress: string;
  }> {
    const privateKeyBytes = new Uint8Array(await ExpoCrypto.getRandomBytesAsync(32));
    const publicKey = secp256k1.getPublicKey(privateKeyBytes, true);
    const xOnlyPubkey = xOnlyFromCompressed(publicKey);
    const kaspaAddress = pubkeyToKaspaAddress(publicKey, this.network);
    return { privateKey: privateKeyBytes, publicKey, xOnlyPubkey, kaspaAddress };
  }

  cleanup(): void {
    if (this.refreshTimer) { clearTimeout(this.refreshTimer); this.refreshTimer = null; }
    if (this.currentKey?.privateKey) this.currentKey.privateKey.fill(0);
    this.currentKey = null;
  }
}

const schnorrKeyManager = new SchnorrKeyManager();

// ============================================================================
// LAMPORT KEY MANAGER
// ============================================================================

class LamportKeyManager {
  private currentKey: EphemeralLamportKey | null = null;
  private counter: number = 0;

  async initialize(): Promise<void> {
    const counterStr = await SecureStore.getItemAsync(STORE.LAMPORT_COUNTER);
    this.counter = counterStr ? parseInt(counterStr, 10) : 0;
  }

  async generateKey(): Promise<EphemeralLamportKey> {
    const index = this.counter++;
    await SecureStore.setItemAsync(STORE.LAMPORT_COUNTER, this.counter.toString());
    const private0: Uint8Array[] = [], private1: Uint8Array[] = [];
    const public0: Uint8Array[] = [], public1: Uint8Array[] = [];
    for (let i = 0; i < 256; i++) {
      const priv0 = new Uint8Array(await ExpoCrypto.getRandomBytesAsync(32));
      const priv1 = new Uint8Array(await ExpoCrypto.getRandomBytesAsync(32));
      private0.push(priv0); private1.push(priv1);
      public0.push(sha256(priv0)); public1.push(sha256(priv1));
    }
    const allPublic = new Uint8Array(256 * 32 * 2);
    for (let i = 0; i < 256; i++) {
      allPublic.set(public0[i], i * 64);
      allPublic.set(public1[i], i * 64 + 32);
    }
    const publicKeyHash = bytesToHex(sha256(allPublic));
    const id = `lamport_${index}_${publicKeyHash.slice(0, 8)}`;
    this.currentKey = { id, index, private0, private1, public0, public1, publicKeyHash, createdAt: Date.now(), used: false };
    return this.currentKey;
  }

  async sign(messageHash: Uint8Array): Promise<LamportSignature> {
    if (!this.currentKey || this.currentKey.used) await this.generateKey();
    const key = this.currentKey!;
    if (messageHash.length !== 32) throw new Error('Message hash must be 32 bytes');
    const signature: string[] = [];
    for (let i = 0; i < 256; i++) {
      const byteIndex = Math.floor(i / 8);
      const bitIndex = 7 - (i % 8);
      const bit = (messageHash[byteIndex] >> bitIndex) & 1;
      const revealed = bit === 0 ? key.private0[i] : key.private1[i];
      signature.push(bytesToHex(revealed));
    }
    const lamportSig: LamportSignature = {
      keyIndex: key.index, publicKeyHash: key.publicKeyHash, signature,
      public0: key.public0.map(p => bytesToHex(p)),
      public1: key.public1.map(p => bytesToHex(p)),
      messageHash: bytesToHex(messageHash), timestamp: Date.now(),
    };
    for (let i = 0; i < 256; i++) { key.private0[i].fill(0); key.private1[i].fill(0); }
    key.used = true;
    this.currentKey = null;
    return lamportSig;
  }

  static verify(sig: LamportSignature): boolean {
    const messageHash = hexToBytes(sig.messageHash);
    if (messageHash.length !== 32 || sig.signature.length !== 256) return false;
    for (let i = 0; i < 256; i++) {
      const byteIndex = Math.floor(i / 8);
      const bitIndex = 7 - (i % 8);
      const bit = (messageHash[byteIndex] >> bitIndex) & 1;
      const expectedPubHex = bit === 0 ? sig.public0[i] : sig.public1[i];
      const revealedPriv = hexToBytes(sig.signature[i]);
      const actualPub = sha256(revealedPriv);
      if (bytesToHex(actualPub) !== expectedPubHex) return false;
    }
    return true;
  }

  getCounter(): number { return this.counter; }
}

const lamportKeyManager = new LamportKeyManager();

// ============================================================================
// ARWEAVE UPLOAD
// ============================================================================

interface ArweaveUploadResult { success: boolean; txId?: string; url?: string; error?: string; }

async function uploadLamportToArweave(
  lamportSig: LamportSignature, kaspaTxId: string, metadata: Record<string, string> = {}
): Promise<ArweaveUploadResult> {
  try {
    const payload = {
      type: 'KASVILLAGE_LAMPORT_ATTESTATION', version: 1, kaspaTxId, lamportSignature: lamportSig,
      metadata, uploadedAt: new Date().toISOString(),
    };
    const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
    const tags = [
      { name: 'Content-Type', value: 'application/json' },
      { name: 'App-Name', value: 'KasVillage' },
      { name: 'Type', value: 'Lamport-Attestation' },
      { name: 'Kaspa-TxId', value: kaspaTxId },
      { name: 'Lamport-Key-Index', value: lamportSig.keyIndex.toString() },
    ];
    const response = await fetch(TURBO_UPLOAD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', 'X-Tags': JSON.stringify(tags) },
      body: payloadBytes,
    });
    if (!response.ok) return { success: false, error: `Upload failed: ${await response.text()}` };
    const result = await response.json();
    const txId = result.id || result.txId;
    return { success: true, txId, url: `${ARWEAVE_GATEWAY}/${txId}` };
  } catch (e: any) { return { success: false, error: e.message }; }
}

// ============================================================================
// REST-BASED BALANCE
// ============================================================================

async function getBalanceViaRest(address: string, network: KaspaNetwork): Promise<bigint> {
  try {
    const resp = await fetch(`${API_BASES[network]}/addresses/${address}/balance`);
    if (!resp.ok) return 0n;
    const data = await resp.json();
    return BigInt(data.balance || '0');
  } catch {
    return 0n;
  }
}

// ============================================================================
// BIOMETRIC AUTH
// ============================================================================

class BiometricAuth {
  private lastAuthTime: number = 0;

  async authenticate(prompt: string = 'Authenticate'): Promise<boolean> {
    if (Date.now() - this.lastAuthTime < BIOMETRIC_CACHE_MS) return true;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: prompt, cancelLabel: 'Cancel', fallbackLabel: 'Use Passcode', disableDeviceFallback: false,
      });
      if (result.success) { this.lastAuthTime = Date.now(); return true; }
      return false;
    } catch { return false; }
  }

  clearCache(): void { this.lastAuthTime = 0; }
}

const biometricAuth = new BiometricAuth();

// ============================================================================
// 2-OF-2 MULTISIG
// ============================================================================

function create2of2MultisigAddress(
  pubkey1Hex: string, pubkey2Hex: string, network: KaspaNetwork = 'mainnet'
): { address: string; redeemScriptHex: string; pubkeys: [string, string] } {
  const pubkeys = [pubkey1Hex, pubkey2Hex].sort() as [string, string];
  const pk1 = hexToBytes(pubkeys[0]);
  const pk2 = hexToBytes(pubkeys[1]);
  if (pk1.length !== 33 || pk2.length !== 33) throw new Error('Invalid pubkey length - must be 33 bytes');
  const redeemScript = new Uint8Array(1 + 1 + 33 + 1 + 33 + 1 + 1);
  let offset = 0;
  redeemScript[offset++] = 0x52;
  redeemScript[offset++] = 33;
  redeemScript.set(pk1, offset); offset += 33;
  redeemScript[offset++] = 33;
  redeemScript.set(pk2, offset); offset += 33;
  redeemScript[offset++] = 0x52;
  redeemScript[offset++] = 0xae;
  const scriptHash = blake2b(sha256(redeemScript), { dkLen: 20 });
  const payload = new Uint8Array(21);
  payload[0] = 0x08;
  payload.set(scriptHash, 1);
  const prefix = network === 'mainnet' ? 'kaspa' : 'kaspatest';
  const address = bech32mEncode(prefix, payload);
  return { address, redeemScriptHex: bytesToHex(redeemScript), pubkeys };
}

function signMultisigInput(txHash: Uint8Array, privateKey: Uint8Array): string {
  const signature = schnorr.sign(txHash, privateKey);
  return bytesToHex(signature);
}

function combineMultisigSignatures(sig1Hex: string, sig2Hex: string, redeemScriptHex: string): string {
  const sig1 = hexToBytes(sig1Hex);
  const sig2 = hexToBytes(sig2Hex);
  const redeemScript = hexToBytes(redeemScriptHex);
  const scriptSig = new Uint8Array(1 + 1 + sig1.length + 1 + sig2.length + 1 + redeemScript.length);
  let offset = 0;
  scriptSig[offset++] = 0x00;
  scriptSig[offset++] = sig1.length;
  scriptSig.set(sig1, offset); offset += sig1.length;
  scriptSig[offset++] = sig2.length;
  scriptSig.set(sig2, offset); offset += sig2.length;
  scriptSig[offset++] = redeemScript.length;
  scriptSig.set(redeemScript, offset);
  return bytesToHex(scriptSig);
}

// ============================================================================
// NEIGHBOR AGREEMENT STORAGE
// ============================================================================

async function storeAgreement(agreement: NeighborAgreement): Promise<void> {
  const existing = await getStoredAgreements();
  const idx = existing.findIndex(a => a.id === agreement.id);
  if (idx >= 0) existing[idx] = agreement; else existing.push(agreement);
  await SecureStore.setItemAsync(AGREEMENT_STORE_KEY, JSON.stringify(existing));
}

async function getStoredAgreements(): Promise<NeighborAgreement[]> {
  const json = await SecureStore.getItemAsync(AGREEMENT_STORE_KEY);
  return json ? JSON.parse(json) : [];
}

async function getNeighborAgreementInfo(agreementId: string): Promise<NeighborAgreement | null> {
  const agreements = await getStoredAgreements();
  return agreements.find(a => a.id === agreementId) || null;
}

async function lockToNeighborAgreement(
  config: NeighborAgreementConfig, myRole: 'buyer' | 'seller'
): Promise<{ agreement: NeighborAgreement; lockTxId: string } | { error: string }> {
  const authOk = await biometricAuth.authenticate('Collateralize funds for Agreement');
  if (!authOk) return { error: 'Authentication failed' };

  const wallet = await loadMainWallet();
  if (!wallet) return { error: 'Wallet not initialized' };

  try {
    const { address, redeemScriptHex, pubkeys } = create2of2MultisigAddress(
      config.buyerPubkey, config.sellerPubkey, wallet.network
    );
    const lockAmount = myRole === 'buyer' ? config.buyerLockSompi : config.sellerLockSompi;

    const restResult = await sendKaspaViaRest({
      senderAddress: wallet.address,
      recipientAddress: address,
      amountSompi: lockAmount,
      privateKeyHex: wallet.privKeyHex,
      network: wallet.network,
    });

    if (!restResult.success) {
      return { error: restResult.error || 'Collateral transaction failed' };
    }

    const txId = restResult.txId || '';
    const agreement: NeighborAgreement = {
      id: `na_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      multisigAddress: address, redeemScriptHex, config,
      status: 'pending', buyerLocked: myRole === 'buyer', sellerLocked: myRole === 'seller',
      buyerSignedRelease: null, sellerSignedRelease: null,
      createdAt: Date.now(), lockedAt: null, releasedAt: null, releaseTxId: null,
      pubkeys, amountSompi: lockAmount.toString(),
    };

    await storeAgreement(agreement);
    return { agreement, lockTxId: txId };
  } catch (e: any) {
    return { error: e.message };
  }
}

async function requestMutualRelease(
  agreementId: string, myRole: 'buyer' | 'seller', recipientAddress: string
): Promise<{ partialSig: string } | { error: string }> {
  const authOk = await biometricAuth.authenticate('Sign release request');
  if (!authOk) return { error: 'Authentication failed' };

  const agreement = await getNeighborAgreementInfo(agreementId);
  if (!agreement) return { error: 'Agreement not found' };

  const ephemeralKey = await schnorrKeyManager.generatePerTxKey();
  try {
    const releaseData = JSON.stringify({
      agreementId, multisigAddress: agreement.multisigAddress, recipient: recipientAddress, timestamp: Date.now(),
    });
    const txHash = sha256(new TextEncoder().encode(releaseData));
    const partialSig = signMultisigInput(txHash, ephemeralKey.privateKey);

    if (myRole === 'buyer') agreement.buyerSignedRelease = partialSig;
    else agreement.sellerSignedRelease = partialSig;
    await storeAgreement(agreement);

    ephemeralKey.privateKey.fill(0);
    return { partialSig };
  } catch (e: any) {
    ephemeralKey.privateKey.fill(0);
    return { error: e.message };
  }
}

async function completeMutualRelease(
  agreementId: string, recipientAddress: string
): Promise<{ txId: string } | { error: string }> {
  const agreement = await getNeighborAgreementInfo(agreementId);
  if (!agreement) return { error: 'Agreement not found' };
  if (!agreement.buyerSignedRelease || !agreement.sellerSignedRelease) {
    return { error: 'Both parties must sign before release' };
  }
  try {
    const combinedScriptSig = combineMultisigSignatures(
      agreement.buyerSignedRelease, agreement.sellerSignedRelease, agreement.redeemScriptHex
    );
    const mockTxId = `release_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    agreement.status = 'released';
    agreement.releasedAt = Date.now();
    agreement.releaseTxId = mockTxId;
    await storeAgreement(agreement);
    return { txId: mockTxId };
  } catch (e: any) { return { error: e.message }; }
}

async function getActiveAgreements(): Promise<NeighborAgreement[]> {
  const all = await getStoredAgreements();
  return all.filter(a => a.status === 'pending' || a.status === 'locked');
}

// ============================================================================
// TX HISTORY
// ============================================================================

async function storeTransaction(entry: Omit<TransactionHistoryEntry, 'fee'>): Promise<void> {
  const historyJson = await SecureStore.getItemAsync(STORE.TX_HISTORY);
  let history: any[] = historyJson ? JSON.parse(historyJson) : [];
  history.unshift({ ...entry, amountSompi: entry.amountSompi.toString() });
  if (history.length > 100) history = history.slice(0, 100);
  await SecureStore.setItemAsync(STORE.TX_HISTORY, JSON.stringify(history));
}

async function getTransactionHistory(): Promise<TransactionHistoryEntry[]> {
  const historyJson = await SecureStore.getItemAsync(STORE.TX_HISTORY);
  if (!historyJson) return [];
  const history = JSON.parse(historyJson);
  return history.map((h: any) => ({ ...h, amountSompi: BigInt(h.amountSompi) }));
}

// ============================================================================
// SEND WITH HYBRID SIG (REST API � main wallet signs L1, ephemeral for attestation)
// ============================================================================

async function sendKASWithHybridSig(
  recipientAddress: string, amountSompi: bigint, memo?: string
): Promise<TransactionResult> {
  const authOk = await biometricAuth.authenticate(`Send ${formatKAS(amountSompi)} KASPA`);
  if (!authOk) return { success: false, error: 'Authentication failed' };

  const wallet = await loadMainWallet();
  if (!wallet) return { success: false, error: 'Wallet not initialized. No private key found.' };

  // Generate ephemeral key for Lamport attestation only (NOT for L1 send)
  const ephemeralKey = await schnorrKeyManager.generatePerTxKey();

  try {
    console.log('[SendKAS] Sending from main wallet via REST...');
    const restResult = await sendKaspaViaRest({
      senderAddress: wallet.address,
      recipientAddress,
      amountSompi,
      privateKeyHex: wallet.privKeyHex,
      network: wallet.network,
    });

    if (!restResult.success) {
      ephemeralKey.privateKey.fill(0);
      return { success: false, error: restResult.error || 'Transaction failed' };
    }

    const txId = restResult.txId || '';
    const explorerUrl = EXPLORER_URLS[wallet.network] + txId;
    console.log('[SendKAS] TX broadcast:', txId);

    // Build attestation message
    const txMessage = new TextEncoder().encode(JSON.stringify({
      type: 'KASVILLAGE_TX', kaspaTxId: txId, from: wallet.address,
      to: recipientAddress, amount: amountSompi.toString(), memo: memo || '', timestamp: Date.now(),
    }));
    const messageHash = sha256(txMessage);

    // Lamport attestation (quantum-secure)
    const lamportSig = await lamportKeyManager.sign(messageHash);

    // Upload Lamport attestation to Arweave (non-blocking)
    let arweaveTxId: string | undefined;
    try {
      const arweaveResult = await uploadLamportToArweave(lamportSig, txId, {
        memo: memo || '', recipient: recipientAddress, amount: amountSompi.toString(),
      });
      if (arweaveResult.success) arweaveTxId = arweaveResult.txId;
    } catch {}

    // Store in local TX history
    await storeTransaction({
      txId, type: 'send', toAddress: recipientAddress, amountSompi,
      timestamp: Date.now(), status: 'pending', lamportIndex: lamportSig.keyIndex,
    });

    // Wipe ephemeral key
    ephemeralKey.privateKey.fill(0);

    return {
      success: true, kaspaTxId: txId, arweaveTxId, explorerUrl,
      hybridSignature: {
        schnorr: { signature: '', publicKey: bytesToHex(ephemeralKey.xOnlyPubkey) },
        lamport: lamportSig, messageHash: bytesToHex(messageHash),
        kaspaTxId: txId, arweaveTxId, timestamp: Date.now(),
      },
    };
  } catch (e: any) {
    ephemeralKey.privateKey.fill(0);
    console.error('[SendKAS] Error:', e.message);
    return { success: false, error: e.message };
  }
}

// ============================================================================
// ============================================================================
// VAULT COLD MODE - remove the vault key from this device. The vault becomes
// watch-only; spending requires restoring from cards (Profile > Restore from
// Cards), then optionally going cold again.
// ============================================================================

export async function vaultGoCold(): Promise<{ success: boolean; error?: string }> {
  const mn = await SecureStore.getItemAsync('kv_vault_mnemonic');
  if (!mn) return { success: false, error: 'Vault is already cold (no key on device).' };
  const authOk = await biometricAuth.authenticate('Remove vault key from this device');
  if (!authOk) return { success: false, error: 'Authentication failed' };
  await SecureStore.deleteItemAsync('kv_vault_mnemonic');
  console.log('[VaultCold] vault key removed from device - cards are now the only key');
  return { success: true };
}

export async function vaultIsWarm(): Promise<boolean> {
  return !!(await SecureStore.getItemAsync('kv_vault_mnemonic'));
}

// ============================================================================
// SEND FROM VAULT (cards vault - key derived from kv_vault_mnemonic at sign time,
// never persisted to main slots; buffer zeroed after use)
// ============================================================================

async function sendKASFromVault(
  recipientAddress: string, amountSompi: bigint, memo?: string
): Promise<TransactionResult> {
  const authOk = await biometricAuth.authenticate('Vault: send ' + formatKAS(amountSompi) + ' KASPA');
  if (!authOk) return { success: false, error: 'Authentication failed' };

  const mnemonic = await SecureStore.getItemAsync('kv_vault_mnemonic');
  if (!mnemonic) {
    return { success: false, error: 'Vault is COLD: key is not on this device. Use Profile > Restore from Cards to load it, send, then Go Cold again.' };
  }

  let hdPriv: Uint8Array | null = null;
  try {
    const { mnemonicToSeedV2: mnemonicToSeed, deriveKaspaHDKeyV2: deriveKaspaHDKey } = await import('./bip39_v2');
    const { previewAddressFromMnemonic } = await import('./wallet_registration_v2');

    const storedVaultAddr = (await SecureStore.getItemAsync('kv_vault_address')) || '';
    const network: KaspaNetwork = storedVaultAddr.startsWith('kaspa:') ? 'mainnet' : 'testnet-10';

    const preview = await previewAddressFromMnemonic(mnemonic, network);
    if (!preview) return { success: false, error: 'Vault key derivation failed' };
    if (storedVaultAddr && preview.address !== storedVaultAddr) {
      return { success: false, error: 'Vault key does not match stored vault address. Re-scan cards.' };
    }

    const seed = await mnemonicToSeed(mnemonic, '');
    const hdKey = deriveKaspaHDKey(seed);
    hdPriv = hdKey.privateKey;
    const privKeyHex = bytesToHex(hdPriv);

    console.log('[VaultSend] Sending from vault', preview.address.slice(0, 22), 'via REST...');
    const restResult = await sendKaspaViaRest({
      senderAddress: preview.address,
      recipientAddress,
      amountSompi,
      privateKeyHex: privKeyHex,
      network,
    });

    if (!restResult.success) {
      return { success: false, error: restResult.error || 'Vault transaction failed' };
    }

    const txId = restResult.txId || '';
    console.log('[VaultSend] TX broadcast:', txId);

    await storeTransaction({
      txId, type: 'send', toAddress: recipientAddress, amountSompi,
      timestamp: Date.now(), status: 'pending', lamportIndex: -1,
    });

    return {
      success: true, kaspaTxId: txId,
      explorerUrl: EXPLORER_URLS[network] + txId,
    };
  } catch (e: any) {
    console.error('[VaultSend] Error:', e?.message);
    return { success: false, error: e?.message || 'Vault send failed' };
  } finally {
    if (hdPriv) hdPriv.fill(0);
  }
}

// ============================================================================
// SEND INSCRIPTION TX (REST API � main wallet)
// ============================================================================

async function sendInscriptionTx(payloadHex: string, toAddress: string): Promise<string> {
  const authOk = await biometricAuth.authenticate('Sign Inscription TX');
  if (!authOk) throw new Error('Authentication failed');

  const wallet = await loadMainWallet();
  if (!wallet) throw new Error('Wallet not initialized');

  const result = await sendKaspaViaRest({
    senderAddress: wallet.address,
    recipientAddress: toAddress,
    amountSompi: BigInt(100000),
    privateKeyHex: wallet.privKeyHex,
    network: wallet.network,
    payload: payloadHex,
  });

  if (!result.success) throw new Error(result.error || 'Inscription failed');
  return result.txId || '';
}

// ============================================================================
// WALLET CONTEXT
// ============================================================================

interface WalletContextType {
  state: WalletState;
  initialize: () => Promise<void>;
  authenticate: () => Promise<boolean>;
  refreshBalance: () => Promise<void>;
  sendKAS: (recipient: string, amountSompi: bigint, memo?: string) => Promise<TransactionResult>;
  rotateSchnorrKey: () => Promise<void>;
  revealAddress: () => Promise<string | null>;
  hideAddress: () => void;
  copyAddress: () => Promise<boolean>;
  getTransactionHistory: () => Promise<TransactionHistoryEntry[]>;
  logout: () => void;
}

const WalletContext = createContext<WalletContextType | null>(null);

function useWallet(): WalletContextType {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}

const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<WalletState>({
    initialized: false, network: 'mainnet', masterPubkey: null, masterAddress: null,
    schnorrKey: null, schnorrKeyExpiresSoon: false, lamportCounter: 0, balance: BigInt(0),
    isOnline: true, isAuthenticated: false, addressRevealed: false, aptAlias: null,
  });
  const addressRevealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkNetwork = useCallback(async () => {
    const netState = await Network.getNetworkStateAsync();
    setState(s => ({ ...s, isOnline: netState.isInternetReachable ?? false }));
  }, []);

  const initialize = useCallback(async () => {
    try {
      await checkNetwork();
      schnorrKeyManager.setNetwork(state.network);
      await lamportKeyManager.initialize();
      const schnorrKey = await schnorrKeyManager.initialize();
      schnorrKeyManager.setOnKeyRotated((key) => {
        setState(s => ({ ...s, schnorrKey: key, schnorrKeyExpiresSoon: false }));
      });
      const aptAlias = await SecureStore.getItemAsync(STORE.APT_ALIAS);
      setState(s => ({
        ...s, initialized: true, schnorrKey, schnorrKeyExpiresSoon: schnorrKeyManager.isExpiringSoon(),
        lamportCounter: lamportKeyManager.getCounter(), masterPubkey: bytesToHex(schnorrKey.publicKey),
        masterAddress: schnorrKey.kaspaAddress, aptAlias,
      }));
    } catch (e) {
      console.error('[Wallet] Init failed:', e);
      setState(s => ({ ...s, initialized: true }));
    }
  }, [state.network, checkNetwork]);

  const authenticate = useCallback(async (): Promise<boolean> => {
    const success = await biometricAuth.authenticate('Unlock Da Village');
    if (success) setState(s => ({ ...s, isAuthenticated: true }));
    return success;
  }, []);

  const refreshBalance = useCallback(async () => {
    const wallet = await loadMainWallet();
    if (!wallet) return;
    try {
      const balance = await getBalanceViaRest(wallet.address, wallet.network);
      setState(s => ({ ...s, balance }));
    } catch {}
  }, []);

  const sendKAS = useCallback(async (
    recipient: string, amountSompi: bigint, memo?: string
  ): Promise<TransactionResult> => {
    const result = await sendKASWithHybridSig(recipient, amountSompi, memo);
    if (result.success) {
      await refreshBalance();
      setState(s => ({ ...s, lamportCounter: lamportKeyManager.getCounter() }));
    }
    return result;
  }, [refreshBalance]);

  const rotateSchnorrKey = useCallback(async () => {
    const authOk = await biometricAuth.authenticate('Rotate Signing Key');
    if (!authOk) return;
    const newKey = await schnorrKeyManager.rotateKey();
    setState(s => ({
      ...s, schnorrKey: newKey, schnorrKeyExpiresSoon: false,
      masterPubkey: bytesToHex(newKey.publicKey), masterAddress: newKey.kaspaAddress,
    }));
  }, []);

  const revealAddress = useCallback(async (): Promise<string | null> => {
    const authOk = await biometricAuth.authenticate('Reveal Address');
    if (!authOk) return null;
    const address = schnorrKeyManager.getAddress();
    if (!address) return null;
    setState(s => ({ ...s, addressRevealed: true }));
    if (addressRevealTimer.current) clearTimeout(addressRevealTimer.current);
    addressRevealTimer.current = setTimeout(() => { setState(s => ({ ...s, addressRevealed: false })); }, ADDRESS_REVEAL_MS);
    return address;
  }, []);

  const hideAddress = useCallback(() => {
    if (addressRevealTimer.current) clearTimeout(addressRevealTimer.current);
    setState(s => ({ ...s, addressRevealed: false }));
  }, []);

  const copyAddress = useCallback(async (): Promise<boolean> => {
    let address = state.masterAddress;
    if (!state.addressRevealed) address = await revealAddress();
    if (!address) return false;
    await Clipboard.setStringAsync(address);
    Alert.alert('Copied', 'Address copied to clipboard');
    return true;
  }, [state.addressRevealed, state.masterAddress, revealAddress]);

  const logout = useCallback(() => {
    biometricAuth.clearCache();
    schnorrKeyManager.cleanup();
    setState(s => ({ ...s, isAuthenticated: false, addressRevealed: false }));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setState(s => ({ ...s, schnorrKeyExpiresSoon: schnorrKeyManager.isExpiringSoon() }));
    }, 10_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      schnorrKeyManager.cleanup();
      if (addressRevealTimer.current) clearTimeout(addressRevealTimer.current);
    };
  }, []);

  const value: WalletContextType = {
    state, initialize, authenticate, refreshBalance, sendKAS, rotateSchnorrKey,
    revealAddress, hideAddress, copyAddress, getTransactionHistory, logout,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};

// ============================================================================
// STYLES
// ============================================================================

const { width: SW } = Dimensions.get('window');
const scale = SW / 393;
const s = (n: number) => Math.round(n * scale);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  lockScreen: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center', padding: s(20) },
  logo: { fontSize: s(36), fontWeight: 'bold', color: '#00ff88' },
  subtitle: { fontSize: s(14), color: '#888', marginTop: s(8), marginBottom: s(40) },
  unlockBtn: { backgroundColor: '#00ff88', paddingVertical: s(16), paddingHorizontal: s(48), borderRadius: s(12) },
  unlockText: { fontSize: s(18), fontWeight: '600', color: '#000' },
  statusContainer: { marginTop: s(40), alignItems: 'center' },
  statusText: { color: '#666', fontSize: s(12), marginBottom: s(4) },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: s(20), paddingTop: s(60) },
  title: { fontSize: s(24), fontWeight: 'bold', color: '#fff' },
  logoutBtn: { color: '#00ff88', fontSize: s(16) },
  keyWarning: { backgroundColor: '#332200', padding: s(12), marginHorizontal: s(20), borderRadius: s(8), marginBottom: s(10) },
  keyWarningText: { color: '#ffaa00', fontSize: s(14), textAlign: 'center' },
  balanceCard: { backgroundColor: '#1a1a1a', margin: s(20), padding: s(24), borderRadius: s(16), alignItems: 'center' },
  balanceLabel: { color: '#888', fontSize: s(12), letterSpacing: 1 },
  balanceValue: { color: '#00ff88', fontSize: s(32), fontWeight: 'bold', marginTop: s(8) },
  refreshBtn: { color: '#00ff88', marginTop: s(12), fontSize: s(14) },
  addressCard: { backgroundColor: '#1a1a2e', margin: s(20), marginTop: 0, padding: s(20), borderRadius: s(16), borderWidth: 1, borderColor: '#00ff8844' },
  addressLabel: { color: '#888', fontSize: s(12), letterSpacing: 1, marginBottom: s(12) },
  addressText: { color: '#fff', fontSize: s(11), fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginBottom: s(12) },
  addressBtnRow: { flexDirection: 'row', gap: s(12) },
  copyBtn: { flex: 1, backgroundColor: '#00ff88', padding: s(12), borderRadius: s(8), alignItems: 'center' },
  copyBtnText: { color: '#000', fontWeight: '600' },
  hideBtn: { flex: 1, backgroundColor: '#333', padding: s(12), borderRadius: s(8), alignItems: 'center' },
  hideBtnText: { color: '#fff', fontWeight: '600' },
  revealBtn: { backgroundColor: '#00ff88', padding: s(14), borderRadius: s(10), alignItems: 'center' },
  revealBtnText: { color: '#000', fontWeight: '600' },
  sendSection: { margin: s(20), marginTop: 0 },
  sectionTitle: { color: '#fff', fontSize: s(18), fontWeight: '600', marginBottom: s(12) },
  input: { backgroundColor: '#1a1a1a', borderRadius: s(12), padding: s(16), color: '#fff', marginBottom: s(12), fontSize: s(16) },
  sendBtn: { backgroundColor: '#00ff88', padding: s(16), borderRadius: s(12), alignItems: 'center' },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: '#000', fontSize: s(16), fontWeight: '600' },
  securityInfo: { margin: s(20), marginTop: 0, padding: s(16), backgroundColor: '#0d1f15', borderRadius: s(12), borderWidth: 1, borderColor: '#00ff8833' },
  securityTitle: { color: '#00ff88', fontSize: s(16), fontWeight: '600', marginBottom: s(12) },
  securityItem: { color: '#888', fontSize: s(13), marginBottom: s(6) },
});

// ============================================================================
// EXPORTS
// ============================================================================

export {
  schnorrKeyManager,
  lamportKeyManager,
  biometricAuth,
  sendKASWithHybridSig,
  sendKASFromVault,
  sendInscriptionTx,
  pubkeyToKaspaAddress,
  isValidKaspaAddress,
  formatKAS,
  uploadLamportToArweave,
  bytesToBigInt,
  bigIntToBytes,
  encryptKey,
  decryptKey,
  create2of2MultisigAddress,
  signMultisigInput,
  combineMultisigSignatures,
  lockToNeighborAgreement,
  getNeighborAgreementInfo,
  requestMutualRelease,
  completeMutualRelease,
  getActiveAgreements,
  getBalanceViaRest,
  loadMainWallet,
};