// ============================================================================
// KASVILLAGE EXPO - WALLET REGISTRATION & VERIFICATION MODULE (V3)
// ============================================================================
// NON-CUSTODIAL FLOW:
// - Phone generates keys locally (private key NEVER leaves device)
// - Avatar-derived BIP39 wallet (same answers = same wallet = recovery)
// - Stealth keys generated from same seed (scan + spend keypairs)
// - Town Hall only verifies and assigns APT
// - Dual-write to Kaspa L1 + Arweave
// - Hash-based indexing for privacy (8-byte prefixes)
// ============================================================================

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import * as secp from '@noble/secp256k1';
const { getPublicKey, schnorr, etc: secpEtc } = secp as unknown as {
  getPublicKey: (privKey: Uint8Array, compressed: boolean) => Uint8Array;
  schnorr: { sign: (msg: Uint8Array, privKey: Uint8Array) => Promise<Uint8Array> };
  etc: { hmacSha256Sync: ((key: Uint8Array, ...msgs: Uint8Array[]) => Uint8Array) | undefined };
};
import { sha256 } from '@noble/hashes/sha256';
// @noble/hashes/hmac — inline fallback if types are missing
let _hmacFn: ((key: Uint8Array, ...msgs: Uint8Array[]) => Uint8Array) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { hmac } = require('@noble/hashes/hmac') as { hmac: (h: unknown, k: Uint8Array, m: Uint8Array) => Uint8Array };
  _hmacFn = (key, ...msgs) => hmac(sha256, key, concatU8(...msgs));
} catch {
  _hmacFn = null;
}
function concatU8(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

// Import shared types and client
import {
  CanonicalAvatar,
  UserStats as SharedUserStats,
  SnailModeStatus,
  UserVerifyResponse,
  AptRegisterResponse,
  IdentityAnchorResponse,
  DeviceRecoveryResponse,
  StoreVerifyResponse,
  DAppVerifyResponse,
  RiskRating,
  XPTier,
  TRAITS_TO_BUY,
  TRAITS_TO_SELL,
  CANONICAL_AVATAR_FIELDS,
  countTraits,
  canBuy,
  canSell,
  hashCanonicalAvatar,
  serializeCanonicalAvatar,
  getXPTier,
  getXPTierColor,
} from './shared_types';

import { townHall, TownHallClient } from './townhall_client';
import { deriveWalletFromIdentityHash, validateMnemonic } from './bip39_wallet';
import { generateStealthKeys, StealthKeys } from './stealth_watcher';

// ============================================================================
// CONSTANTS
// ============================================================================
const ARWEAVE_GATEWAY = 'https://arweave.net';
const BUNDLR_NODE = 'https://node2.irys.xyz';

// ============================================================================
// HELPERS (defined before use)
// ============================================================================

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

// Wire @noble/secp256k1 v2 HMAC-SHA256
secpEtc.hmacSha256Sync = (key: Uint8Array, ...msgs: Uint8Array[]) => {
  if (_hmacFn) return _hmacFn(key, ...msgs);
  return sha256(concatU8(key, ...msgs)); // fallback
};

// SHA-256 async wrapper
async function sha256Async(data: Uint8Array): Promise<Uint8Array> {
  const hex = bytesToHex(data);
  const hashHex = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    hex,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  return hexToBytes(hashHex);
}

// ============================================================================
// KASPA BECH32 — Correct 40-bit polymod with 8-char checksum
// Ported from rusty-kaspa/crypto/addresses/src/bech32.rs
// ============================================================================
const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

// Kaspa uses a 40-bit BCH code (NOT standard 30-bit bech32/bech32m)
// Generator constants from Kaspa source
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

function kaspaConv8to5(payload: number[]): number[] {
  const result: number[] = [];
  let buff = 0, bits = 0;
  for (const c of payload) {
    buff = (buff << 8) | c;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result.push((buff >> bits) & 31);
      buff &= (1 << bits) - 1;
    }
  }
  if (bits > 0) result.push((buff << (5 - bits)) & 31);
  return result;
}

function kaspaAddressFromXOnly(xOnlyPubkey: Uint8Array, hrp = 'kaspa'): string {
  // Version byte 0 (Schnorr P2PK) + 32-byte x-only pubkey
  const fullPayload = [0, ...Array.from(xOnlyPubkey)];
  const fivebitPayload = kaspaConv8to5(fullPayload);
  
  // Prefix expansion: lower 5 bits of each char
  const fivebitPrefix = Array.from(hrp).map(c => c.charCodeAt(0) & 0x1f);
  
  // Checksum input: prefix + [0] + payload + [0,0,0,0,0,0,0,0]
  const checksumInput = [...fivebitPrefix, 0, ...fivebitPayload, 0, 0, 0, 0, 0, 0, 0, 0];
  const cs = kaspaPolymod(checksumInput);
  
  // Convert checksum (u64) last 5 bytes to 5-bit
  // cs is 40 bits max. Extract as 5 bytes then conv8to5
  const csBytes: number[] = [];
  for (let i = 4; i >= 0; i--) {
    csBytes.push(Number((cs >> BigInt(i * 8)) & 0xFFn));
  }
  const cs5bit = kaspaConv8to5(csBytes);
  
  // Encode
  let addr = hrp + ':';
  for (const d of [...fivebitPayload, ...cs5bit]) {
    addr += BECH32_CHARSET[d];
  }
  return addr;
}

// ============================================================================
// HASH INDEXING
// ============================================================================
// 8-byte (16 hex char) hash prefix for Arweave tag indexing

function computeHashIndex(input: string): string {
  const hash = sha256(new TextEncoder().encode(input));
  return bytesToHex(hash.slice(0, 8));
}

export function hashApt(apt: string): string {
  return computeHashIndex(`APT:${apt}`);
}

export function hashPubkey(pubkey: string): string {
  return computeHashIndex(`PK:${pubkey}`);
}

export function hashAddress(address: string): string {
  return computeHashIndex(`ADDR:${address}`);
}

export function hashAgreement(agreementId: string): string {
  return computeHashIndex(`AGR:${agreementId}`);
}

// ============================================================================
// ACCESS LEVELS
// ============================================================================

export const ACCESS_LEVELS = {
  GUEST: { minTraits: 0, maxTraits: 8 },
  RESIDENT: { minTraits: 9, maxTraits: 12 },
  PASSPORT_ELIGIBLE: { minTraits: 13, maxTraits: 18, verified: false },
  VERIFIED_PASSPORT: { minTraits: 13, maxTraits: 18, verified: true },
} as const;

export const ACCESS_PERMISSIONS = {
  GUEST: {
    canBrowse: true,
    canBuy: false,
    canUseDApps: false,
    canUseAcademics: false,
    canUseServices: false,
    canPostStorefront: false,
    canPostAcademic: false,
    canPostService: false,
    canPostDApp: false,
    visibleInSearch: false,
  },
  RESIDENT: {
    canBrowse: true,
    canBuy: true,
    canUseDApps: true,
    canUseAcademics: true,
    canUseServices: true,
    canPostStorefront: false,
    canPostAcademic: false,
    canPostService: false,
    canPostDApp: false,
    visibleInSearch: false,
  },
  PASSPORT_ELIGIBLE: {
    canBrowse: true,
    canBuy: true,
    canUseDApps: true,
    canUseAcademics: true,
    canUseServices: true,
    canPostStorefront: false,
    canPostAcademic: false,
    canPostService: false,
    canPostDApp: false,
    visibleInSearch: false,
  },
  VERIFIED_PASSPORT: {
    canBrowse: true,
    canBuy: true,
    canUseDApps: true,
    canUseAcademics: true,
    canUseServices: true,
    canPostStorefront: true,
    canPostAcademic: true,
    canPostService: true,
    canPostDApp: true,
    visibleInSearch: true,
  },
};

// ============================================================================
// SECURE STORE KEYS
// ============================================================================

const STORE_KEYS = {
  PRIVATE_KEY: 'kv_private_key',
  PUBLIC_KEY: 'kv_public_key',
  KASPA_ADDRESS: 'kv_kaspa_address',
  MASTER_SEED: 'kv_master_seed',
  APT_NUMBER: 'kv_apt_number',
  REGISTRATION_TX: 'kv_registration_tx',
  VERIFICATION_TX: 'kv_verification_tx',
  KASPA_TX_ID: 'kv_kaspa_tx_id',
  DEVICE_ATTESTATION_HASH: 'kv_device_attestation_hash',
  USER_STATS: 'kv_user_stats',
  AVATAR: 'kv_avatar',
  REGISTRATION_STATUS: 'kv_registration_status',
  VERIFICATION_STATUS: 'kv_verification_status',
  // Stealth keys
  STEALTH_SCAN_PRIV: 'kv_stealth_scan_priv',
  STEALTH_SCAN_PUB: 'kv_stealth_scan_pub',
  STEALTH_SPEND_PRIV: 'kv_stealth_spend_priv',
  STEALTH_SPEND_PUB: 'kv_stealth_spend_pub',
  STEALTH_ENABLED: 'kv_stealth_enabled',
};

// ============================================================================
// TYPES
// ============================================================================

export type RegistrationStatus =
  | 'unregistered'
  | 'wallet_created'
  | 'attestation_sent'
  | 'apt_assigned'
  | 'registered';

export type VerificationStatus =
  | 'unverified'
  | 'pending'
  | 'verified';

export type AccessLevel =
  | 'GUEST'
  | 'RESIDENT'
  | 'PASSPORT_ELIGIBLE'
  | 'VERIFIED_PASSPORT';

export interface UserStats {
  xp: number;
  successes: number;
  deadlocks: number;
  totalTransactions: number;
  createdAt: number;
  lastActiveAt: number;
  snailModeUntil: number | null;
}

export interface RegistrationData {
  publicKeyHex: string;
  kaspaAddress: string;
  stealthAddress: string | null;
  aptNumber: string | null;
  registrationTx: string | null;
  verificationTx: string | null;
  kaspaTxId: string | null;
  registrationStatus: RegistrationStatus;
  verificationStatus: VerificationStatus;
  accessLevel: AccessLevel;
  traitCount: number;
  stats: UserStats;
  xpTier: XPTier;
}

export interface DeviceAttestationPayload {
  publicKeyHex: string;
  attestationToken: string;
  deviceId: string;
  platform: 'ios' | 'android';
  ipCountry?: string;
}

// Arweave identity record (hashed tags)
export interface ArweaveIdentityTags {
  'App-Name': 'KasVillage';
  'App-Version': '1.0.0';
  'Type': 'KV_IDENTITY_V1';
  'APT-Hash': string;
  'Pubkey-Hash': string;
  'Address-Hash': string;
  'Content-Type': 'application/json';
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createDefaultUserStats(): UserStats {
  const now = Date.now();
  return {
    xp: 0,
    successes: 0,
    deadlocks: 0,
    totalTransactions: 0,
    createdAt: now,
    lastActiveAt: now,
    snailModeUntil: null,
  };
}

async function derivePublicKey(privateKeyHex: string): Promise<string> {
  const privBytes = hexToBytes(privateKeyHex);
  const pubBytes = getPublicKey(privBytes, true); // compressed 33 bytes
  return bytesToHex(pubBytes);
}

async function deriveKaspaAddress(publicKeyHex: string): Promise<string> {
  const pubBytes = hexToBytes(publicKeyHex);
  const xOnly = pubBytes.slice(1); // drop 02/03 prefix → 32 bytes
  return kaspaAddressFromXOnly(xOnly, 'kaspa');
}

async function signMessage(message: string): Promise<string> {
  const privateKeyHex = await SecureStore.getItemAsync(STORE_KEYS.PRIVATE_KEY);
  if (!privateKeyHex) throw new Error('No private key');

  const msgBytes = new TextEncoder().encode(message);
  const msgHash = await sha256Async(msgBytes);
  const privBytes = hexToBytes(privateKeyHex);
  const sig = await schnorr.sign(msgHash, privBytes);
  return bytesToHex(sig);
}

// ============================================================================
// STEP 1: CREATE WALLET (Avatar-derived, deterministic + Stealth keys)
// ============================================================================

export async function createWallet(options?: {
  identityHashHex?: string;
  skipAuth?: boolean;
  network?: 'mainnet' | 'testnet-10' | 'testnet-11';
}): Promise<{
  success: boolean;
  publicKey?: string;
  kaspaAddress?: string;
  mnemonic?: string;
  stealthAddress?: string;
  error?: string;
}> {
  try {
    // Skip auth if caller already authenticated (e.g. PhaseAnchor after quiz biometric)
    if (!options?.skipAuth) {
      const bioAvailable = await LocalAuthentication.hasHardwareAsync();
      const bioEnrolled = await LocalAuthentication.isEnrolledAsync();

      // Use biometrics if available, otherwise fall back to device passcode/PIN
      const authResult = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to secure your wallet',
        fallbackLabel: 'Use Passcode',
        disableDeviceFallback: false, // Allow PIN/passcode fallback on both iOS and Android
        ...(bioAvailable && bioEnrolled ? {} : {
          // No biometrics enrolled — this will show device PIN/passcode prompt
        }),
      });

      if (!authResult.success) {
        return { success: false, error: 'Authentication failed or cancelled' };
      }
    }

    let wallet: {
      mnemonic: string;
      privateKeyHex: string;
      publicKeyHex: string;
      kaspaAddress: string;
      seed: Uint8Array;
    };

    if (false && options?.identityHashHex) { // SECURITY: brainwallet path disabled - all wallets use random entropy (Option A)
      // DETERMINISTIC PATH (avatar-derived)
      const derived = await deriveWalletFromIdentityHash(options!.identityHashHex!);
      const seedBytes = sha256(hexToBytes(options!.identityHashHex!));
      // Re-derive address with correct network prefix
      const pubBytes = hexToBytes(derived.publicKeyHex);
      const xOnly = pubBytes.slice(1);
      const hrp = options?.network?.startsWith('testnet') ? 'kaspatest' : 'kaspa';
      wallet = { ...derived, kaspaAddress: kaspaAddressFromXOnly(xOnly, hrp), seed: seedBytes };
    } else {
      // FALLBACK: random entropy
      const { entropyToMnemonic, mnemonicToSeed, deriveKaspaHDKey } = await import('./bip39_wallet');
      const randomEntropy = await Crypto.getRandomBytesAsync(16);
      const mnemonic = await entropyToMnemonic(randomEntropy);
      const seed = await mnemonicToSeed(mnemonic, '');
      const hdKey = deriveKaspaHDKey(seed);
      const pubBytes = getPublicKey(hdKey.privateKey, true);
      const xOnly = pubBytes.slice(1);
      wallet = {
        mnemonic,
        privateKeyHex: bytesToHex(hdKey.privateKey),
        publicKeyHex: bytesToHex(pubBytes),
        kaspaAddress: kaspaAddressFromXOnly(xOnly, options?.network?.startsWith('testnet') ? 'kaspatest' : 'kaspa'),
        seed: seed.slice(0, 32),
      };
    }

    // Generate stealth keys from seed
    const stealthKeys = await generateStealthKeys(wallet.seed);
    const stealthAddress = `stealth:${stealthKeys.scanPublicKey}:${stealthKeys.spendPublicKey}`;

    // Store in SecureStore
    await SecureStore.setItemAsync(STORE_KEYS.PRIVATE_KEY, wallet.privateKeyHex, {
      keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
    });
    await SecureStore.setItemAsync(STORE_KEYS.PUBLIC_KEY, wallet.publicKeyHex);
    await SecureStore.setItemAsync(STORE_KEYS.KASPA_ADDRESS, wallet.kaspaAddress);
    await SecureStore.setItemAsync(STORE_KEYS.MASTER_SEED, bytesToHex(wallet.seed), {
      keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
    });
    await SecureStore.setItemAsync('kv_mnemonic', wallet.mnemonic, {
      keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
    });
    await SecureStore.setItemAsync(STORE_KEYS.REGISTRATION_STATUS, 'wallet_created');
    await AsyncStorage.setItem(STORE_KEYS.USER_STATS, JSON.stringify(createDefaultUserStats()));

    // === ENCRYPTED KEY STORAGE (for identity_inscription_v6 compatibility) ===
    // Generate device encryption key if not exists
    let deviceEncKey = await SecureStore.getItemAsync('device_encryption_key');
    if (!deviceEncKey) {
      const randomBytes = await Crypto.getRandomBytesAsync(32);
      deviceEncKey = Array.from(new Uint8Array(randomBytes), b => b.toString(16).padStart(2, '0')).join('');
      await SecureStore.setItemAsync('device_encryption_key', deviceEncKey, {
        keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
      });
    }
    // XOR encrypt private key with SHA256(deviceKey + privateKey)
    const combined = deviceEncKey + wallet.privateKeyHex;
    const keyStream = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      combined,
    );
    const encryptedChars: string[] = [];
    for (let i = 0; i < 64; i += 2) {
      const privByte = parseInt(wallet.privateKeyHex.slice(i, i + 2), 16);
      const ksByte = parseInt(keyStream.slice(i % keyStream.length, (i % keyStream.length) + 2), 16);
      encryptedChars.push((privByte ^ ksByte).toString(16).padStart(2, '0'));
    }
    const privateKeyEnc = encryptedChars.join('');
    await SecureStore.setItemAsync('kv_l1_privkey_enc', JSON.stringify({ privateKeyEnc }), {
      keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
    });
    // Also save address under inscription's key name
    await SecureStore.setItemAsync('kaspa_address', wallet.kaspaAddress);
    // Save network
    await SecureStore.setItemAsync('kaspa_network', options?.network || 'testnet-10');

    console.log('[Wallet] Created with stealth support');
    console.log(`[Wallet] Address: ${wallet.kaspaAddress}`);

    return {
      success: true,
      publicKey: wallet.publicKeyHex,
      kaspaAddress: wallet.kaspaAddress,
      mnemonic: wallet.mnemonic,
      stealthAddress,
    };
  } catch (error) {
    console.error('[createWallet] failed:', error);
    return { success: false, error: 'Wallet creation failed. Please try again.' };
  }
}

export async function restoreWalletFromMnemonic(
  mnemonic: string,
  network: 'mainnet' | 'testnet-10' | 'testnet-11' = 'testnet-10',
): Promise<{
  success: boolean;
  publicKey?: string;
  kaspaAddress?: string;
  error?: string;
}> {
  try {
    if (!mnemonic || mnemonic.trim().split(/\s+/).length !== 12) {
      return { success: false, error: 'Invalid recovery phrase (need 12 words)' };
    }

    const { mnemonicToSeed, deriveKaspaHDKey } = await import('./bip39_wallet');

    // EMPTY passphrase — must match createWallet's random branch exactly.
    const seed = await mnemonicToSeed(mnemonic, '');
    const hdKey = deriveKaspaHDKey(seed);
    const pubBytes = getPublicKey(hdKey.privateKey, true);
    const xOnly = pubBytes.slice(1);
    const hrp = network.startsWith('testnet') ? 'kaspatest' : 'kaspa';

    const wallet = {
      mnemonic,
      privateKeyHex: bytesToHex(hdKey.privateKey),
      publicKeyHex: bytesToHex(pubBytes),
      kaspaAddress: kaspaAddressFromXOnly(xOnly, hrp),
      seed: seed.slice(0, 32),
    };

    // Stealth keys from the same 32-byte seed slice (as createWallet).
    await generateStealthKeys(wallet.seed);

    // ---- identical SecureStore writes ----
    await SecureStore.setItemAsync(STORE_KEYS.PRIVATE_KEY, wallet.privateKeyHex, {
      keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
    });
    await SecureStore.setItemAsync(STORE_KEYS.PUBLIC_KEY, wallet.publicKeyHex);
    await SecureStore.setItemAsync(STORE_KEYS.KASPA_ADDRESS, wallet.kaspaAddress);
    await SecureStore.setItemAsync(STORE_KEYS.MASTER_SEED, bytesToHex(wallet.seed), {
      keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
    });
    await SecureStore.setItemAsync(STORE_KEYS.REGISTRATION_STATUS, 'wallet_created');

    // preserve stats cache if present, else seed defaults (TownHall refills by pubkey)
    const existingStats = await AsyncStorage.getItem(STORE_KEYS.USER_STATS);
    if (!existingStats) {
      await AsyncStorage.setItem(STORE_KEYS.USER_STATS, JSON.stringify(createDefaultUserStats()));
    }

    // ---- encrypted privkey block (identity_inscription_v6 compatibility) ----
    let deviceEncKey = await SecureStore.getItemAsync('device_encryption_key');
    if (!deviceEncKey) {
      const randomBytes = await Crypto.getRandomBytesAsync(32);
      deviceEncKey = Array.from(new Uint8Array(randomBytes), b => b.toString(16).padStart(2, '0')).join('');
      await SecureStore.setItemAsync('device_encryption_key', deviceEncKey, {
        keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
      });
    }
    const combined = deviceEncKey + wallet.privateKeyHex;
    const keyStream = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      combined,
    );
    const encryptedChars: string[] = [];
    for (let i = 0; i < 64; i += 2) {
      const privByte = parseInt(wallet.privateKeyHex.slice(i, i + 2), 16);
      const ksByte = parseInt(keyStream.slice(i % keyStream.length, (i % keyStream.length) + 2), 16);
      encryptedChars.push((privByte ^ ksByte).toString(16).padStart(2, '0'));
    }
    await SecureStore.setItemAsync('kv_l1_privkey_enc', JSON.stringify({ privateKeyEnc: encryptedChars.join('') }), {
      keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
    });

    await SecureStore.setItemAsync('kaspa_address', wallet.kaspaAddress);
    await SecureStore.setItemAsync('kaspa_network', network);

    // export continuity + boot-as-returning:
    await SecureStore.setItemAsync('kv_mnemonic', mnemonic, {
      keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
    });
    await SecureStore.setItemAsync('kv_verified', 'true'); // AppNavigator boot treats as returning

    console.log('[restoreWallet] Restored address:', wallet.kaspaAddress);
    return { success: true, publicKey: wallet.publicKeyHex, kaspaAddress: wallet.kaspaAddress };
  } catch (error) {
    console.error('[restoreWalletFromMnemonic] failed:', error);
    return { success: false, error: 'Wallet restore failed.' };
  }
}

// ============================================================================
// STEP 2: GENERATE DEVICE ATTESTATION
// ============================================================================

export async function generateDeviceAttestation(): Promise<{
  success: boolean;
  attestation?: DeviceAttestationPayload;
  error?: string;
}> {
  try {
    const publicKeyHex = await SecureStore.getItemAsync(STORE_KEYS.PUBLIC_KEY);
    if (!publicKeyHex) {
      return { success: false, error: 'Wallet not created' };
    }

    // Fix: parentheses around || before ?? to avoid mixed operator error
    const iosId = await Application.getIosIdForVendorAsync();
    const deviceId = (iosId || Device.osBuildId) ?? 'unknown';
    const platform = Device.osName?.toLowerCase() === 'ios' ? 'ios' : 'android';

    const attestationData = JSON.stringify({
      deviceId,
      platform,
      osVersion: Device.osVersion,
      deviceModel: Device.modelName,
      isDevice: Device.isDevice,
      timestamp: Date.now(),
    });

    const attestationToken = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      attestationData
    );

    await SecureStore.setItemAsync(STORE_KEYS.DEVICE_ATTESTATION_HASH, attestationToken);

    return {
      success: true,
      attestation: {
        publicKeyHex,
        attestationToken,
        deviceId,
        platform,
      },
    };
  } catch (error) {
    console.error('Device attestation failed:', error);
    return { success: false, error: 'Failed to generate attestation' };
  }
}

// ============================================================================
// STEP 3: REGISTER WITH TOWN HALL (Get APT assignment)
// ============================================================================

export async function registerWithTownHall(
  avatar: CanonicalAvatar,
  deviceAttestation?: string
): Promise<{
  success: boolean;
  aptNumber?: string;
  kaspaAddress?: string;
  arweaveTx?: string;
  kaspaTxId?: string;
  error?: string;
}> {
  try {
    await SecureStore.setItemAsync(STORE_KEYS.AVATAR, JSON.stringify(avatar));
    await SecureStore.setItemAsync(STORE_KEYS.REGISTRATION_STATUS, 'attestation_sent');

    const result: AptRegisterResponse = await townHall.registerApt(avatar, deviceAttestation);

    if (!result.success) {
      return { success: false, error: result.error || 'Registration failed' };
    }

    if (result.aptAlias) {
      await SecureStore.setItemAsync(STORE_KEYS.APT_NUMBER, result.aptAlias);
    }
    if (result.arweaveTx) {
      await SecureStore.setItemAsync(STORE_KEYS.REGISTRATION_TX, result.arweaveTx);
    }
    if (result.kaspaTxId) {
      await SecureStore.setItemAsync(STORE_KEYS.KASPA_TX_ID, result.kaspaTxId);
    }
    await SecureStore.setItemAsync(STORE_KEYS.REGISTRATION_STATUS, 'apt_assigned');

    return {
      success: true,
      aptNumber: result.aptAlias,
      kaspaAddress: result.kaspaAddress,
      arweaveTx: result.arweaveTx,
      kaspaTxId: result.kaspaTxId,
    };
  } catch (error) {
    console.error('Town Hall registration failed:', error);
    return { success: false, error: 'Network error' };
  }
}

// ============================================================================
// STEP 4: ANCHOR IDENTITY (Dual-write to L1 + Arweave)
// ============================================================================

export async function anchorIdentity(): Promise<{
  success: boolean;
  kaspaTxId?: string;
  arweaveTxId?: string;
  merkleRoot?: string;
  arweaveTags?: ArweaveIdentityTags;
  error?: string;
}> {
  try {
    const avatarJson = await SecureStore.getItemAsync(STORE_KEYS.AVATAR);
    const publicKeyHex = await SecureStore.getItemAsync(STORE_KEYS.PUBLIC_KEY);
    const kaspaAddress = await SecureStore.getItemAsync(STORE_KEYS.KASPA_ADDRESS);
    const aptNumber = await SecureStore.getItemAsync(STORE_KEYS.APT_NUMBER);

    if (!avatarJson || !publicKeyHex || !kaspaAddress || !aptNumber) {
      return { success: false, error: 'Missing registration data' };
    }

    const avatar: CanonicalAvatar = JSON.parse(avatarJson);

    const arweaveTags: ArweaveIdentityTags = {
      'App-Name': 'KasVillage',
      'App-Version': '1.0.0',
      'Type': 'KV_IDENTITY_V1',
      'APT-Hash': hashApt(aptNumber),
      'Pubkey-Hash': hashPubkey(publicKeyHex),
      'Address-Hash': hashAddress(kaspaAddress),
      'Content-Type': 'application/json',
    };

    const result: IdentityAnchorResponse = await townHall.anchorIdentity(avatar);

    if (!result.success) {
      return { success: false, error: result.error || 'Anchor failed' };
    }

    if (result.kaspaTxId) {
      await SecureStore.setItemAsync(STORE_KEYS.KASPA_TX_ID, result.kaspaTxId);
    }
    if (result.arweaveTxId) {
      await SecureStore.setItemAsync(STORE_KEYS.REGISTRATION_TX, result.arweaveTxId);
    }
    await SecureStore.setItemAsync(STORE_KEYS.REGISTRATION_STATUS, 'registered');

    return {
      success: true,
      kaspaTxId: result.kaspaTxId,
      arweaveTxId: result.arweaveTxId,
      merkleRoot: result.merkleRoot,
      arweaveTags,
    };
  } catch (error) {
    console.error('Identity anchor failed:', error);
    return { success: false, error: 'Network error' };
  }
}

// ============================================================================
// STEP 5: REQUEST VERIFICATION (for sellers - 13+ traits)
// ============================================================================

export async function requestVerification(): Promise<{
  success: boolean;
  verified?: boolean;
  arweaveTx?: string;
  kaspaTxId?: string;
  snailMode?: SnailModeStatus;
  error?: string;
}> {
  try {
    const aptNumber = await SecureStore.getItemAsync(STORE_KEYS.APT_NUMBER);
    const avatarJson = await SecureStore.getItemAsync(STORE_KEYS.AVATAR);

    if (!aptNumber) {
      return { success: false, error: 'Not registered yet' };
    }

    const avatar: CanonicalAvatar = avatarJson ? JSON.parse(avatarJson) : {};
    const traitCount = countTraits(avatar);

    if (traitCount < TRAITS_TO_SELL) {
      return { success: false, error: `Need ${TRAITS_TO_SELL} traits, have ${traitCount}` };
    }

    await SecureStore.setItemAsync(STORE_KEYS.VERIFICATION_STATUS, 'pending');

    const result: UserVerifyResponse = await townHall.verifyUser(aptNumber, {
      includeStats: true,
      includeSnailMode: true,
    });

    if (!result.verified) {
      await SecureStore.setItemAsync(STORE_KEYS.VERIFICATION_STATUS, 'unverified');
      return { success: false, error: result.error || 'Verification failed' };
    }

    if (result.arweaveProof) {
      await SecureStore.setItemAsync(STORE_KEYS.VERIFICATION_TX, result.arweaveProof);
    }
    if (result.kaspaInscription) {
      await SecureStore.setItemAsync(STORE_KEYS.KASPA_TX_ID, result.kaspaInscription);
    }
    await SecureStore.setItemAsync(STORE_KEYS.VERIFICATION_STATUS, 'verified');

    if (result.stats) {
      await updateUserStats({
        xp: result.stats.xp,
        successes: result.stats.successes,
        deadlocks: result.stats.deadlocks,
      });
    }

    return {
      success: true,
      verified: true,
      arweaveTx: result.arweaveProof,
      kaspaTxId: result.kaspaInscription,
      snailMode: result.snailMode,
    };
  } catch (error) {
    console.error('Verification request failed:', error);
    await SecureStore.setItemAsync(STORE_KEYS.VERIFICATION_STATUS, 'unverified');
    return { success: false, error: 'Network error' };
  }
}

// ============================================================================
// DEVICE RECOVERY
// ============================================================================

export async function recoverDevice(
  avatar: CanonicalAvatar,
  newPublicKey: string,
  deviceAttestation?: string
): Promise<{
  success: boolean;
  aptNumber?: string;
  matched: boolean;
  matchedFields?: string[];
  error?: string;
}> {
  try {
    const result: DeviceRecoveryResponse = await townHall.recoverDevice(
      avatar,
      newPublicKey,
      deviceAttestation
    );

    if (!result.success || !result.matched) {
      return {
        success: false,
        matched: false,
        matchedFields: result.matchedFields,
        error: result.error || 'Recovery failed - traits do not match',
      };
    }

    if (result.aptAlias) {
      await SecureStore.setItemAsync(STORE_KEYS.APT_NUMBER, result.aptAlias);
    }
    await SecureStore.setItemAsync(STORE_KEYS.PUBLIC_KEY, newPublicKey);
    await SecureStore.setItemAsync(STORE_KEYS.AVATAR, JSON.stringify(avatar));
    await SecureStore.setItemAsync(STORE_KEYS.REGISTRATION_STATUS, 'registered');

    return {
      success: true,
      aptNumber: result.aptAlias,
      matched: true,
      matchedFields: result.matchedFields,
    };
  } catch (error) {
    console.error('Device recovery failed:', error);
    return { success: false, matched: false, error: 'Network error' };
  }
}

// ============================================================================
// ACCESS LEVEL CALCULATION
// ============================================================================

export function countAvatarTraits(avatar: Record<string, unknown>): number {
  if (!avatar) return 0;

  let count = 0;
  for (const field of CANONICAL_AVATAR_FIELDS) {
    const value = avatar[field];
    if (value && typeof value === 'string' && value.trim().length > 2) {
      count++;
    }
  }
  return count;
}

export function calculatePComplete(stats: UserStats): number {
  return (1 + stats.successes) / (2 + stats.successes + stats.deadlocks);
}

export async function getAccessLevel(): Promise<AccessLevel> {
  const avatarJson = await SecureStore.getItemAsync(STORE_KEYS.AVATAR);
  const verificationStatus = await SecureStore.getItemAsync(STORE_KEYS.VERIFICATION_STATUS);

  const avatar = avatarJson ? JSON.parse(avatarJson) : {};
  const traitCount = countAvatarTraits(avatar);
  const isVerified = verificationStatus === 'verified';

  if (traitCount >= TRAITS_TO_SELL && isVerified) return 'VERIFIED_PASSPORT';
  if (traitCount >= TRAITS_TO_SELL) return 'PASSPORT_ELIGIBLE';
  if (traitCount >= TRAITS_TO_BUY) return 'RESIDENT';
  return 'GUEST';
}

export async function canPerformAction(
  action: keyof (typeof ACCESS_PERMISSIONS)['GUEST']
): Promise<boolean> {
  const level = await getAccessLevel();
  return ACCESS_PERMISSIONS[level][action];
}

export async function isVisibleInSearch(): Promise<boolean> {
  const level = await getAccessLevel();
  return ACCESS_PERMISSIONS[level].visibleInSearch;
}

// ============================================================================
// STEALTH ADDRESS HELPERS
// ============================================================================

export async function getStealthAddress(): Promise<string | null> {
  const scanPub = await SecureStore.getItemAsync(STORE_KEYS.STEALTH_SCAN_PUB);
  const spendPub = await SecureStore.getItemAsync(STORE_KEYS.STEALTH_SPEND_PUB);
  if (!scanPub || !spendPub) return null;
  return `stealth:${scanPub}:${spendPub}`;
}

export async function isStealthEnabled(): Promise<boolean> {
  const enabled = await SecureStore.getItemAsync(STORE_KEYS.STEALTH_ENABLED);
  return enabled === 'true';
}

export async function regenerateStealthKeys(): Promise<StealthKeys | null> {
  const seedHex = await SecureStore.getItemAsync(STORE_KEYS.MASTER_SEED);
  if (!seedHex) {
    console.error('[Wallet] No master seed found');
    return null;
  }
  return generateStealthKeys(hexToBytes(seedHex));
}

// ============================================================================
// FULL REGISTRATION DATA
// ============================================================================

export async function getRegistrationData(): Promise<RegistrationData | null> {
  try {
    const publicKeyHex = await SecureStore.getItemAsync(STORE_KEYS.PUBLIC_KEY);
    const kaspaAddress = await SecureStore.getItemAsync(STORE_KEYS.KASPA_ADDRESS);
    const stealthAddress = await getStealthAddress();
    const aptNumber = await SecureStore.getItemAsync(STORE_KEYS.APT_NUMBER);
    const registrationTx = await SecureStore.getItemAsync(STORE_KEYS.REGISTRATION_TX);
    const verificationTx = await SecureStore.getItemAsync(STORE_KEYS.VERIFICATION_TX);
    const kaspaTxId = await SecureStore.getItemAsync(STORE_KEYS.KASPA_TX_ID);
    const registrationStatus = (
      (await SecureStore.getItemAsync(STORE_KEYS.REGISTRATION_STATUS)) ?? 'unregistered'
    ) as RegistrationStatus;
    const verificationStatus = (
      (await SecureStore.getItemAsync(STORE_KEYS.VERIFICATION_STATUS)) ?? 'unverified'
    ) as VerificationStatus;
    const avatarJson = await SecureStore.getItemAsync(STORE_KEYS.AVATAR);
    const statsJson = await AsyncStorage.getItem(STORE_KEYS.USER_STATS);

    if (!publicKeyHex || !kaspaAddress) {
      return null;
    }

    const avatar = avatarJson ? JSON.parse(avatarJson) : {};
    const stats: UserStats = statsJson ? JSON.parse(statsJson) : createDefaultUserStats();
    const traitCount = countAvatarTraits(avatar);
    const accessLevel = await getAccessLevel();
    const xpTier = getXPTier(stats.xp);

    return {
      publicKeyHex,
      kaspaAddress,
      stealthAddress,
      aptNumber,
      registrationTx,
      verificationTx,
      kaspaTxId,
      registrationStatus,
      verificationStatus,
      accessLevel,
      traitCount,
      stats,
      xpTier,
    };
  } catch (error) {
    console.error('Failed to get registration data:', error);
    return null;
  }
}

// ============================================================================
// USER STATS MANAGEMENT
// ============================================================================

export async function getUserStats(): Promise<UserStats> {
  // Try TownHall first (cross-references Arweave + L1)
  try {
    const pubkey = await SecureStore.getItemAsync('kv_public_key');
    console.log('[getUserStats] pubkey:', pubkey?.slice(0, 16));
    if (pubkey) {
      const resp = await fetch('https://kasvillage.app.runonflux.io' + '/user-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pubkey }),
      });
      if (resp.ok) {
        const stats = await resp.json();
        // Cache locally for offline access
        await AsyncStorage.setItem(STORE_KEYS.USER_STATS, JSON.stringify(stats));
        console.log('[getUserStats] TownHall returned xp:', stats.xp);
        return stats as UserStats;
      }
    }
  } catch (e) {
    console.warn('[Stats] TownHall unreachable, using local cache');
  }
  // Fallback to local SecureStore cache
  const statsJson = await AsyncStorage.getItem(STORE_KEYS.USER_STATS);
  return statsJson ? JSON.parse(statsJson) : createDefaultUserStats();
}

export async function updateUserStats(updates: Partial<UserStats>): Promise<UserStats> {
  const current = await getUserStats();
  const updated: UserStats = {
    ...current,
    ...updates,
    lastActiveAt: Date.now(),
  };
  await AsyncStorage.setItem(STORE_KEYS.USER_STATS, JSON.stringify(updated));
  return updated;
}

export async function recordSuccess(): Promise<UserStats> {
  const stats = await getUserStats();
  return updateUserStats({
    successes: stats.successes + 1,
    totalTransactions: stats.totalTransactions + 1,
    xp: stats.xp + 10,
  });
}

export async function recordDeadlock(): Promise<UserStats> {
  const stats = await getUserStats();
  const newDeadlocks = stats.deadlocks + 1;
  const snailMinutes = Math.min(1 + newDeadlocks, 10);
  const snailModeUntil = Date.now() + snailMinutes * 60 * 1000;

  return updateUserStats({
    deadlocks: newDeadlocks,
    totalTransactions: stats.totalTransactions + 1,
    xp: Math.max(0, stats.xp - 20),
    snailModeUntil,
  });
}

export async function isInSnailMode(): Promise<boolean> {
  const stats = await getUserStats();

  if (stats.totalTransactions < 3) return false;
  if (stats.xp < 150) return true;
  if (calculatePComplete(stats) < 0.5) return true;
  if (stats.snailModeUntil && Date.now() < stats.snailModeUntil) return true;

  return false;
}

export async function getCreationDelayMs(): Promise<number> {
  const isSnail = await isInSnailMode();
  if (!isSnail) return 0;

  const stats = await getUserStats();
  const minutes = Math.min(1 + stats.deadlocks, 10);
  return minutes * 60 * 1000;
}

// ============================================================================
// SYNC WITH TOWN HALL
// ============================================================================

export async function syncWithTownHall(): Promise<{
  success: boolean;
  stats?: UserStats;
  snailMode?: SnailModeStatus;
  error?: string;
}> {
  try {
    const aptNumber = await SecureStore.getItemAsync(STORE_KEYS.APT_NUMBER);
    if (!aptNumber) {
      return { success: false, error: 'Not registered' };
    }

    const result = await townHall.verifyUser(aptNumber, {
      includeStats: true,
      includeSnailMode: true,
    });

    if (result.stats) {
      await updateUserStats({
        xp: result.stats.xp,
        successes: result.stats.successes,
        deadlocks: result.stats.deadlocks,
      });
    }

    const stats = await getUserStats();

    return {
      success: true,
      stats,
      snailMode: result.snailMode,
    };
  } catch (error) {
    console.error('Sync failed:', error);
    return { success: false, error: 'Network error' };
  }
}

// ============================================================================
// SEARCH VISIBILITY CHECK
// ============================================================================

export async function checkListingVisibility(
  listingArweaveTx: string
): Promise<{ visible: boolean; reason?: string }> {
  try {
    const response = await fetch(`${ARWEAVE_GATEWAY}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query CheckVerification($tx: String!) {
            transactions(
              tags: [
                { name: "App-Name", values: ["KasVillage"] },
                { name: "Type", values: ["KV_VERIFICATION_PROOF_V1"] },
                { name: "Listing-TX", values: [$tx] }
              ],
              first: 1
            ) {
              edges {
                node {
                  id
                  tags { name value }
                }
              }
            }
          }
        `,
        variables: { tx: listingArweaveTx },
      }),
    });

    const data = await response.json();
    const hasProof = data?.data?.transactions?.edges?.length > 0;

    return hasProof
      ? { visible: true }
      : { visible: false, reason: 'No verification proof found' };
  } catch {
    return { visible: false, reason: 'Failed to check verification' };
  }
}

export function filterVerifiedListings<T extends { verificationTx?: string; verified?: boolean }>(
  listings: T[]
): T[] {
  return listings.filter(listing => listing.verified === true || !!listing.verificationTx);
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  STORE_KEYS,
  ARWEAVE_GATEWAY,
  townHall,
  computeHashIndex,
  // Re-export shared types
  type CanonicalAvatar,
  type SnailModeStatus,
  type RiskRating,
  type XPTier,
  TRAITS_TO_BUY,
  TRAITS_TO_SELL,
  CANONICAL_AVATAR_FIELDS,
  countTraits,
  canBuy,
  canSell,
  getXPTier,
  getXPTierColor,
};