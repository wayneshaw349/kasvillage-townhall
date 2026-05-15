// ============================================================================
// KASVILLAGE - STEALTH ADDRESS UTXO WATCHER
// ============================================================================
// Watches for incoming stealth payments via wRPC subscription
// Uses ECDH to derive one-time addresses from scan/spend keypairs
//
// Flow:
// 1. Sender creates ephemeral keypair (r, R = r*G)
// 2. Sender computes shared secret S = r * scan_pubkey
// 3. Sender derives one-time address: P = spend_pubkey + hash(S)*G
// 4. Sender sends to P, includes R in OP_RETURN
// 5. Receiver scans OP_RETURN for R values
// 6. Receiver computes S' = scan_privkey * R
// 7. Receiver derives P' = spend_pubkey + hash(S')*G
// 8. If P' matches output, receiver can spend with: spend_privkey + hash(S')
// ============================================================================

import { uploadToIrys } from './arweave_upload';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { sha256 } from '@noble/hashes/sha256.js';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

// ============================================================================
// KASPA CLIENT - INLINE MINIMAL IMPLEMENTATION
// ============================================================================
// To avoid circular deps, we inline the minimal wRPC calls needed here
// If you have KaspaClient.ts in your project, you can import from there instead

type KaspaNetwork = 'mainnet' | 'testnet-10' | 'testnet-11';

const RESOLVER_URLS: Record<KaspaNetwork, string[]> = {
  'mainnet': ['wss://wrpc.kaspa.org'],
  'testnet-10': ['wss://wrpc-tn10.kaspa.org'],
  'testnet-11': ['wss://wrpc-tn11.kaspa.org'],
};

let _ws: WebSocket | null = null;
let _network: KaspaNetwork = 'testnet-10';
let _requestId = 0;
let _pendingRequests: Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }> = new Map();
let _subscriptions: Map<string, (data: unknown) => void> = new Map();

async function ensureConnected(): Promise<void> {
  if (_ws && _ws.readyState === WebSocket.OPEN) return;
  
  const networkStr = await SecureStore.getItemAsync('kaspa_network');
  _network = (networkStr === 'mainnet' || networkStr === 'testnet-10' || networkStr === 'testnet-11')
    ? networkStr as KaspaNetwork
    : 'testnet-10';
  
  const urls = RESOLVER_URLS[_network];
  
  return new Promise((resolve, reject) => {
    _ws = new WebSocket(urls[0]);
    _ws.onopen = () => resolve();
    _ws.onerror = (e) => reject(new Error('WebSocket error: ' + String(e)));
    _ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.id !== undefined && _pendingRequests.has(msg.id)) {
          const { resolve, reject } = _pendingRequests.get(msg.id)!;
          _pendingRequests.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message || 'RPC error'));
          else resolve(msg.result);
        }
        // Handle subscription notifications
        if (msg.method && _subscriptions.has(msg.method)) {
          _subscriptions.get(msg.method)!(msg.params);
        }
      } catch {}
    };
    _ws.onclose = () => { _ws = null; };
  });
}

async function rpcCall(method: string, params: unknown = {}): Promise<unknown> {
  await ensureConnected();
  const id = ++_requestId;
  return new Promise((resolve, reject) => {
    _pendingRequests.set(id, { resolve, reject });
    _ws!.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
    setTimeout(() => {
      if (_pendingRequests.has(id)) {
        _pendingRequests.delete(id);
        reject(new Error('RPC timeout'));
      }
    }, 30000);
  });
}

async function subscribeUtxosChangedInternal(
  addresses: string[],
  callback: (data: unknown) => void
): Promise<string> {
  await ensureConnected();
  const uid = 'utxo_' + Date.now();
  _subscriptions.set('notifyUtxosChanged', callback);
  await rpcCall('notifyUtxosChangedRequest', { addresses });
  return uid;
}

async function unsubscribeUtxosChangedInternal(_uid: string): Promise<void> {
  _subscriptions.delete('notifyUtxosChanged');
  // Note: wRPC doesn't have explicit unsubscribe, just stop listening
}

interface UtxoEntryInternal {
  txId: string;
  index: number;
  amount: bigint;
}

async function getUtxosInternal(address: string): Promise<UtxoEntryInternal[]> {
  const result = await rpcCall('getUtxosByAddresses', { addresses: [address] }) as { entries?: unknown[] };
  if (!result.entries) return [];
  return result.entries.map((e: unknown) => {
    const entry = e as { outpoint?: { transactionId?: string; index?: number }; utxoEntry?: { amount?: string } };
    return {
      txId: entry.outpoint?.transactionId || '',
      index: entry.outpoint?.index || 0,
      amount: BigInt(entry.utxoEntry?.amount || '0'),
    };
  });
}

async function getTransactionInternal(txId: string): Promise<unknown | null> {
  try {
    return await rpcCall('getTransaction', { transactionId: txId, includeOrphan: true });
  } catch {
    return null;
  }
}

// Generate random bytes using expo-crypto
async function getRandomBytes(length: number): Promise<Uint8Array> {
  return Crypto.getRandomBytesAsync(length);
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SECURESTORE_KEYS = {
  STEALTH_SCAN_PRIV: 'kv_stealth_scan_priv',
  STEALTH_SCAN_PUB: 'kv_stealth_scan_pub',
  STEALTH_SPEND_PRIV: 'kv_stealth_spend_priv',
  STEALTH_SPEND_PUB: 'kv_stealth_spend_pub',
  STEALTH_ENABLED: 'kv_stealth_enabled',
  STEALTH_PAYMENTS: 'kv_stealth_payments',
  WATCHED_ADDRESSES: 'kv_stealth_watched',
};

// Stealth payment marker in OP_RETURN
const STEALTH_MARKER = new TextEncoder().encode('KVS'); // KasVillage Stealth

// Max addresses to watch (rolling window)
const MAX_WATCHED_ADDRESSES = 100;

// ============================================================================
// TYPES
// ============================================================================

export interface StealthKeys {
  scanPrivateKey: string;  // hex
  scanPublicKey: string;   // hex (33-byte compressed)
  spendPrivateKey: string; // hex
  spendPublicKey: string;  // hex (33-byte compressed)
}

export interface StealthPayment {
  txId: string;
  outputIndex: number;
  amountSompi: bigint;
  oneTimeAddress: string;
  ephemeralPubkey: string;
  spendingKey: string;  // derived private key to spend this UTXO
  timestamp: number;
  spent: boolean;
}

export interface StealthPaymentData {
  oneTimeAddress: string;
  opReturnData: string; // hex
  ephemeralPubkey: string;
}

export interface StealthWatcherState {
  enabled: boolean;
  watchedAddresses: string[];
  pendingPayments: StealthPayment[];
  lastScanDaaScore: bigint;
}

// ============================================================================
// HELPERS
// ============================================================================

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function mod(a: bigint, b: bigint): bigint {
  return ((a % b) + b) % b;
}

// secp256k1 order
const N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n;

// ============================================================================
// STEALTH ADDRESS DERIVATION
// ============================================================================

/**
 * Derive shared secret from ECDH
 * S = privkey * Pubkey
 */
function deriveSharedSecret(privateKey: Uint8Array, publicKey: Uint8Array): Uint8Array {
  const shared = secp256k1.getSharedSecret(privateKey, publicKey);
  // Use x-coordinate only (first 32 bytes of uncompressed, skip prefix)
  return sha256(shared.slice(1, 33));
}

/**
 * Derive one-time public key for stealth payment
 * P = spend_pubkey + hash(S)*G
 */
function deriveOneTimePublicKey(
  spendPubkey: Uint8Array,
  sharedSecret: Uint8Array
): Uint8Array {
  // hash(S) as scalar
  const scalar = sha256(sharedSecret);
  const scalarBigInt = BigInt('0x' + bytesToHex(scalar));
  const scalarMod = mod(scalarBigInt, N);
  
  // hash(S)*G - using ProjectivePoint explicitly
  const G = secp256k1.ProjectivePoint.BASE;
  const hashPoint = G.multiply(scalarMod);
  
  // spend_pubkey as point
  const spendPoint = secp256k1.ProjectivePoint.fromHex(bytesToHex(spendPubkey));
  
  // P = spend_pubkey + hash(S)*G
  // Cast to any to bypass TS recursive type inference limitation
  const oneTimePoint = (spendPoint as any).add(hashPoint);
  
  return oneTimePoint.toRawBytes(true); // compressed
}

/**
 * Derive one-time private key to spend stealth payment
 * p = spend_privkey + hash(S)
 */
function deriveOneTimePrivateKey(
  spendPrivkey: Uint8Array,
  sharedSecret: Uint8Array
): Uint8Array {
  const scalar = sha256(sharedSecret);
  const scalarBigInt = BigInt('0x' + bytesToHex(scalar));
  const spendBigInt = BigInt('0x' + bytesToHex(spendPrivkey));
  
  // p = (spend_privkey + hash(S)) mod N
  const oneTimePriv = mod(spendBigInt + scalarBigInt, N);
  
  // Convert to 32-byte array
  const hex = oneTimePriv.toString(16).padStart(64, '0');
  return hexToBytes(hex);
}

/**
 * Convert compressed pubkey to Kaspa address
 */
function pubkeyToKaspaAddress(pubkey: Uint8Array, prefix: string = 'kaspatest'): string {
  // Extract x-only (32 bytes) from compressed (33 bytes)
  const xOnly = pubkey.slice(1);
  
  // Bech32 encode — correct Kaspa 40-bit polymod
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

  const fullPayload = [0, ...Array.from(xOnly)];
  const fivebitPayload = conv8to5(fullPayload);
  const fivebitPrefix = Array.from(prefix).map(c => c.charCodeAt(0) & 0x1f);
  const checksumInput = [...fivebitPrefix, 0, ...fivebitPayload, 0, 0, 0, 0, 0, 0, 0, 0];
  const cs = kaspaPolymod(checksumInput);
  const csBytes: number[] = [];
  for (let i = 4; i >= 0; i--) csBytes.push(Number((cs >> BigInt(i * 8)) & 0xFFn));
  const cs5bit = conv8to5(csBytes);
  
  let addr = prefix + ':';
  for (const d of [...fivebitPayload, ...cs5bit]) addr += BECH32_CHARSET[d];
  return addr;
}

// ============================================================================
// STEALTH KEYS MANAGEMENT
// ============================================================================

/**
 * Generate stealth keypairs from master seed
 * Derives: scan_key = sha256("stealth_scan" | seed)
 *          spend_key = sha256("stealth_spend" | seed)
 */
export async function generateStealthKeys(masterSeed: Uint8Array): Promise<StealthKeys> {
  const scanTag = new TextEncoder().encode('KV_STEALTH_SCAN:');
  const spendTag = new TextEncoder().encode('KV_STEALTH_SPEND:');
  
  const scanPriv = sha256(new Uint8Array([...scanTag, ...masterSeed]));
  const spendPriv = sha256(new Uint8Array([...spendTag, ...masterSeed]));
  
  const scanPub = secp256k1.getPublicKey(scanPriv, true);
  const spendPub = secp256k1.getPublicKey(spendPriv, true);
  
  const keys: StealthKeys = {
    scanPrivateKey: bytesToHex(scanPriv),
    scanPublicKey: bytesToHex(scanPub),
    spendPrivateKey: bytesToHex(spendPriv),
    spendPublicKey: bytesToHex(spendPub),
  };
  
  // Store in SecureStore
  await SecureStore.setItemAsync(SECURESTORE_KEYS.STEALTH_SCAN_PRIV, keys.scanPrivateKey);
  await SecureStore.setItemAsync(SECURESTORE_KEYS.STEALTH_SCAN_PUB, keys.scanPublicKey);
  await SecureStore.setItemAsync(SECURESTORE_KEYS.STEALTH_SPEND_PRIV, keys.spendPrivateKey);
  await SecureStore.setItemAsync(SECURESTORE_KEYS.STEALTH_SPEND_PUB, keys.spendPublicKey);
  await SecureStore.setItemAsync(SECURESTORE_KEYS.STEALTH_ENABLED, 'true');
  
  console.log('[Stealth] Generated stealth keypairs');
  
  return keys;
}

/**
 * Load stealth keys from SecureStore
 */
export async function loadStealthKeys(): Promise<StealthKeys | null> {
  const scanPriv = await SecureStore.getItemAsync(SECURESTORE_KEYS.STEALTH_SCAN_PRIV);
  const scanPub = await SecureStore.getItemAsync(SECURESTORE_KEYS.STEALTH_SCAN_PUB);
  const spendPriv = await SecureStore.getItemAsync(SECURESTORE_KEYS.STEALTH_SPEND_PRIV);
  const spendPub = await SecureStore.getItemAsync(SECURESTORE_KEYS.STEALTH_SPEND_PUB);
  
  if (!scanPriv || !scanPub || !spendPriv || !spendPub) {
    return null;
  }
  
  return {
    scanPrivateKey: scanPriv,
    scanPublicKey: scanPub,
    spendPrivateKey: spendPriv,
    spendPublicKey: spendPub,
  };
}

/**
 * Get stealth meta address (for sharing)
 * Format: "scan_pubkey:spend_pubkey" (both compressed hex)
 */
export async function getStealthMetaAddress(): Promise<string | null> {
  const keys = await loadStealthKeys();
  if (!keys) return null;
  return `${keys.scanPublicKey}:${keys.spendPublicKey}`;
}

// ============================================================================
// STEALTH PAYMENT CREATION (SENDER SIDE)
// ============================================================================

/**
 * Create stealth payment data for sending
 * Returns one-time address and OP_RETURN data containing ephemeral pubkey
 */
export async function createStealthPayment(
  recipientScanPubkey: string,
  recipientSpendPubkey: string,
  network: 'mainnet' | 'testnet-10' | 'testnet-11' = 'testnet-10'
): Promise<StealthPaymentData> {
  // Generate ephemeral keypair using expo-crypto
  const ephemeralPriv = await getRandomBytes(32);
  const ephemeralPub = secp256k1.getPublicKey(ephemeralPriv, true);
  
  // Derive shared secret: S = ephemeral_priv * scan_pubkey
  const scanPub = hexToBytes(recipientScanPubkey);
  const sharedSecret = deriveSharedSecret(ephemeralPriv, scanPub);
  
  // Derive one-time public key: P = spend_pubkey + hash(S)*G
  const spendPub = hexToBytes(recipientSpendPubkey);
  const oneTimePub = deriveOneTimePublicKey(spendPub, sharedSecret);
  
  // Convert to address
  const prefix = network === 'mainnet' ? 'kaspa' : 'kaspatest';
  const oneTimeAddress = pubkeyToKaspaAddress(oneTimePub, prefix);
  
  // Build OP_RETURN: "KVS" + ephemeral_pubkey (33 bytes)
  const opReturnData = new Uint8Array(STEALTH_MARKER.length + ephemeralPub.length);
  opReturnData.set(STEALTH_MARKER, 0);
  opReturnData.set(ephemeralPub, STEALTH_MARKER.length);
  
  return {
    oneTimeAddress,
    opReturnData: bytesToHex(opReturnData),
    ephemeralPubkey: bytesToHex(ephemeralPub),
  };
}

// ============================================================================
// STEALTH UTXO WATCHER
// ============================================================================

let _watcherSubscriptionId: string | null = null;
let _watchedAddresses: Set<string> = new Set();
let _pendingPayments: Map<string, StealthPayment> = new Map();
let _onPaymentCallback: ((payment: StealthPayment) => void) | null = null;

/**
 * Start watching for stealth payments
 */
export async function startStealthWatcher(
  onPayment?: (payment: StealthPayment) => void
): Promise<boolean> {
  const keys = await loadStealthKeys();
  if (!keys) {
    console.warn('[Stealth] No stealth keys found');
    return false;
  }
  
  _onPaymentCallback = onPayment ?? null;
  
  // Load watched addresses from storage
  const watchedJson = await AsyncStorage.getItem(SECURESTORE_KEYS.WATCHED_ADDRESSES);
  if (watchedJson) {
    try {
      const addresses = JSON.parse(watchedJson) as string[];
      _watchedAddresses = new Set(addresses);
    } catch {}
  }
  
  // Load pending payments
  const paymentsJson = await AsyncStorage.getItem(SECURESTORE_KEYS.STEALTH_PAYMENTS);
  if (paymentsJson) {
    try {
      const payments = JSON.parse(paymentsJson) as Array<StealthPayment & { amountSompi: string }>;
      for (const p of payments) {
        const payment: StealthPayment = {
          ...p,
          amountSompi: BigInt(p.amountSompi),
        };
        _pendingPayments.set(p.txId + ':' + p.outputIndex, payment);
      }
    } catch {}
  }
  
  // Generate next batch of one-time addresses to watch
  await generateWatchAddresses(keys, 20);
  
  // Subscribe to UTXO changes
  if (_watchedAddresses.size > 0) {
    const addresses = Array.from(_watchedAddresses);
    _watcherSubscriptionId = await subscribeUtxosChangedInternal(addresses, (data: unknown) => {
      handleUtxoChange(data, keys);
    });
    console.log(`[Stealth] Watching ${addresses.length} addresses`);
  }
  
  return true;
}

/**
 * Stop stealth watcher
 */
export async function stopStealthWatcher(): Promise<void> {
  if (_watcherSubscriptionId) {
    await unsubscribeUtxosChangedInternal(_watcherSubscriptionId);
    _watcherSubscriptionId = null;
  }
  _watchedAddresses.clear();
  _onPaymentCallback = null;
  console.log('[Stealth] Watcher stopped');
}

/**
 * Generate next batch of one-time addresses to watch
 * Uses deterministic derivation from stealth keys + index
 */
async function generateWatchAddresses(keys: StealthKeys, count: number): Promise<void> {
  const prefix = 'kaspatest'; // TODO: get from network config
  const spendPub = hexToBytes(keys.spendPublicKey);
  
  // Get current index
  const indexKey = 'kv_stealth_index';
  const indexStr = await AsyncStorage.getItem(indexKey);
  const startIndex = indexStr ? parseInt(indexStr, 10) : 0;
  
  for (let i = 0; i < count; i++) {
    const index = startIndex + i;
    
    // Derive pseudo-ephemeral from index
    // In real scanning, we check actual ephemeral from OP_RETURN
    // This is for pre-generating addresses to watch
    const indexBytes = new Uint8Array(4);
    new DataView(indexBytes.buffer).setUint32(0, index, false);
    
    const pseudoSecret = sha256(new Uint8Array([
      ...hexToBytes(keys.scanPrivateKey),
      ...indexBytes,
    ]));
    
    const oneTimePub = deriveOneTimePublicKey(spendPub, pseudoSecret);
    const address = pubkeyToKaspaAddress(oneTimePub, prefix);
    
    _watchedAddresses.add(address);
  }
  
  // Trim to max
  if (_watchedAddresses.size > MAX_WATCHED_ADDRESSES) {
    const all = Array.from(_watchedAddresses);
    _watchedAddresses = new Set(all.slice(-MAX_WATCHED_ADDRESSES));
  }
  
  // Save
  await AsyncStorage.setItem(indexKey, String(startIndex + count));
  await SecureStore.setItemAsync(
    SECURESTORE_KEYS.WATCHED_ADDRESSES,
    JSON.stringify(Array.from(_watchedAddresses))
  );
}

/**
 * Handle UTXO change event
 */
async function handleUtxoChange(data: unknown, keys: StealthKeys): Promise<void> {
  // Type guard for data structure
  const utxoData = data as { added?: Array<{
    address?: string;
    outpoint?: { transactionId?: string; index?: number };
    utxoEntry?: { amount?: string | number };
  }> };
  
  const added = utxoData.added || [];
  
  for (const entry of added) {
    const address = entry.address;
    
    if (!address || !_watchedAddresses.has(address)) continue;
    
    console.log(`[Stealth] Potential payment to ${address}`);
    
    // Try to get TX to check for OP_RETURN with ephemeral pubkey
    const txId = entry.outpoint?.transactionId;
    if (!txId) continue;
    
    try {
      const tx = await getTransactionInternal(txId);
      if (!tx) continue;
      
      // Look for OP_RETURN output with stealth marker
      const ephemeralPubkey = findEphemeralPubkey(tx);
      if (!ephemeralPubkey) {
        console.log('[Stealth] No ephemeral pubkey in TX, not a stealth payment');
        continue;
      }
      
      // Verify this is actually for us
      const verified = verifyStealthPayment(
        keys,
        ephemeralPubkey,
        address
      );
      
      if (!verified) {
        console.log('[Stealth] Address mismatch, not for us');
        continue;
      }
      
      // Derive spending key
      const ephemeralPub = hexToBytes(ephemeralPubkey);
      const scanPriv = hexToBytes(keys.scanPrivateKey);
      const sharedSecret = deriveSharedSecret(scanPriv, ephemeralPub);
      const spendPriv = hexToBytes(keys.spendPrivateKey);
      const oneTimePriv = deriveOneTimePrivateKey(spendPriv, sharedSecret);
      
      const payment: StealthPayment = {
        txId,
        outputIndex: entry.outpoint?.index ?? 0,
        amountSompi: BigInt(entry.utxoEntry?.amount ?? 0),
        oneTimeAddress: address,
        ephemeralPubkey,
        spendingKey: bytesToHex(oneTimePriv),
        timestamp: Date.now(),
        spent: false,
      };
      
      const key = `${txId}:${payment.outputIndex}`;
      _pendingPayments.set(key, payment);
      
      // Persist with bigint serialization
      await persistPayments();
      
      console.log(`[Stealth] ✓ Received stealth payment: ${payment.amountSompi} sompi`);
      
      // Callback
      if (_onPaymentCallback) {
        _onPaymentCallback(payment);
      }
      
      // Generate more watch addresses
      await generateWatchAddresses(keys, 5);
      
    } catch (e) {
      console.error('[Stealth] Error processing UTXO:', e);
    }
  }
}

/**
 * Find ephemeral pubkey in TX OP_RETURN
 */
function findEphemeralPubkey(tx: unknown): string | null {
  const txData = tx as { outputs?: Array<{
    scriptPublicKey?: { script?: string } | string;
  }> };
  
  const outputs = txData.outputs || [];
  
  for (const out of outputs) {
    const scriptPubKey = out.scriptPublicKey;
    const script = typeof scriptPubKey === 'string' 
      ? scriptPubKey 
      : scriptPubKey?.script;
    if (!script) continue;
    
    // Decode script
    const scriptBytes = hexToBytes(script);
    
    // Check for OP_RETURN (0x6a)
    if (scriptBytes[0] !== 0x6a) continue;
    
    // Get data after push opcode
    const dataLen = scriptBytes[1];
    const data = scriptBytes.slice(2, 2 + dataLen);
    
    // Check for stealth marker
    if (data.length < STEALTH_MARKER.length + 33) continue;
    
    const marker = data.slice(0, STEALTH_MARKER.length);
    if (bytesToHex(marker) !== bytesToHex(STEALTH_MARKER)) continue;
    
    // Extract ephemeral pubkey (33 bytes compressed)
    const ephemeralPub = data.slice(STEALTH_MARKER.length, STEALTH_MARKER.length + 33);
    return bytesToHex(ephemeralPub);
  }
  
  return null;
}

/**
 * Verify stealth payment is for us
 */
function verifyStealthPayment(
  keys: StealthKeys,
  ephemeralPubkey: string,
  receivedAddress: string
): boolean {
  try {
    const ephemeralPub = hexToBytes(ephemeralPubkey);
    const scanPriv = hexToBytes(keys.scanPrivateKey);
    const spendPub = hexToBytes(keys.spendPublicKey);
    
    // Compute shared secret: S = scan_priv * ephemeral_pub
    const sharedSecret = deriveSharedSecret(scanPriv, ephemeralPub);
    
    // Derive expected one-time pubkey: P = spend_pub + hash(S)*G
    const expectedPub = deriveOneTimePublicKey(spendPub, sharedSecret);
    
    // Convert to address
    const prefix = receivedAddress.startsWith('kaspa:') ? 'kaspa' : 'kaspatest';
    const expectedAddress = pubkeyToKaspaAddress(expectedPub, prefix);
    
    return expectedAddress === receivedAddress;
  } catch {
    return false;
  }
}

// ============================================================================
// STEALTH PAYMENT MANAGEMENT (Single implementations)
// ============================================================================

/**
 * Persist payments to SecureStore with bigint serialization
 */
async function persistPayments(): Promise<void> {
  const serialized = Array.from(_pendingPayments.values()).map(p => ({
    ...p,
    amountSompi: p.amountSompi.toString(),
  }));
  await AsyncStorage.setItem(SECURESTORE_KEYS.STEALTH_PAYMENTS, JSON.stringify(serialized));
  // Backup to Arweave (fire-and-forget)
  backupStealthMetadataToArweave().catch(() => {});
}

/**
 * Get all pending (unspent) stealth payments
 */
export async function getPendingStealthPayments(): Promise<StealthPayment[]> {
  const json = await AsyncStorage.getItem(SECURESTORE_KEYS.STEALTH_PAYMENTS);
  if (!json) return [];
  
  try {
    const payments = JSON.parse(json) as Array<StealthPayment & { amountSompi: string }>;
    // Convert bigint strings back
    return payments.map(p => ({
      ...p,
      amountSompi: BigInt(p.amountSompi),
    }));
  } catch {
    return [];
  }
}

/**
 * Get all unspent stealth payments
 */
export async function getUnspentStealthPayments(): Promise<StealthPayment[]> {
  const payments = await getPendingStealthPayments();
  return payments.filter(p => !p.spent);
}

/**
 * Get total stealth balance (unspent)
 */
export async function getStealthBalance(): Promise<bigint> {
  const payments = await getUnspentStealthPayments();
  return payments.reduce((sum, p) => sum + p.amountSompi, 0n);
}

/**
 * Mark a stealth payment as spent
 */
export async function markStealthPaymentSpent(txId: string, outputIndex: number): Promise<void> {
  const key = `${txId}:${outputIndex}`;
  const payment = _pendingPayments.get(key);
  
  if (payment) {
    payment.spent = true;
    _pendingPayments.set(key, payment);
  }
  
  // Also update persisted storage
  const payments = await getPendingStealthPayments();
  const updated = payments.map(p => {
    if (`${p.txId}:${p.outputIndex}` === key) {
      return { ...p, spent: true };
    }
    return p;
  });
  
  const serialized = updated.map(p => ({
    ...p,
    amountSompi: p.amountSompi.toString(),
  }));
  
  await AsyncStorage.setItem(SECURESTORE_KEYS.STEALTH_PAYMENTS, JSON.stringify(serialized));
}

/**
 * Get spending key for a stealth payment
 */
export async function getStealthSpendingKey(txId: string, outputIndex: number): Promise<string | null> {
  const payments = await getPendingStealthPayments();
  const payment = payments.find(p => p.txId === txId && p.outputIndex === outputIndex);
  return payment?.spendingKey || null;
}

// ============================================================================
// MANUAL SCAN (FALLBACK)
// ============================================================================

/**
 * Manually scan recent transactions for stealth payments
 * Use when subscription might have missed payments
 */
// ============================================================================
// REST API ALTERNATIVES (works in Expo Go without wRPC)
// ============================================================================

async function getUtxosREST(address: string, apiBase: string): Promise<UtxoEntryInternal[]> {
  try {
    const resp = await fetch(`${apiBase}/addresses/${address}/utxos`);
    if (!resp.ok) return [];
    const data = await resp.json();
    if (!Array.isArray(data)) return [];
    return data.map((u: any) => ({
      txId: u.outpoint?.transactionId || u.outpoint?.transaction_id || "",
      index: u.outpoint?.index || 0,
      amount: BigInt(u.utxoEntry?.amount || u.utxo_entry?.amount || "0"),
    }));
  } catch { return []; }
}

async function getTransactionREST(txId: string, apiBase: string): Promise<unknown | null> {
  try {
    const resp = await fetch(`${apiBase}/transactions/${txId}`);
    if (!resp.ok) return null;
    return await resp.json();
  } catch { return null; }
}

export async function scanForStealthPaymentsREST(
  apiBase: string = "https://api-tn10.kaspa.org"
): Promise<StealthPayment[]> {
  const keys = await loadStealthKeys();
  if (!keys) return [];

  const addresses = Array.from(_watchedAddresses);
  if (addresses.length === 0) {
    await generateWatchAddresses(keys, 20);
    addresses.push(...Array.from(_watchedAddresses));
  }
  if (addresses.length === 0) return [];

  const found: StealthPayment[] = [];

  for (const address of addresses) {
    try {
      const utxos = await getUtxosREST(address, apiBase);

      for (const utxo of utxos) {
        const key = `${utxo.txId}:${utxo.index}`;
        if (_pendingPayments.has(key)) continue;

        const tx = await getTransactionREST(utxo.txId, apiBase);
        if (!tx) continue;

        const ephemeralPubkey = findEphemeralPubkey(tx);
        if (!ephemeralPubkey) continue;

        if (!verifyStealthPayment(keys, ephemeralPubkey, address)) continue;

        const ephemeralPub = hexToBytes(ephemeralPubkey);
        const scanPriv = hexToBytes(keys.scanPrivateKey);
        const sharedSecret = deriveSharedSecret(scanPriv, ephemeralPub);
        const spendPriv = hexToBytes(keys.spendPrivateKey);
        const oneTimePriv = deriveOneTimePrivateKey(spendPriv, sharedSecret);

        const payment: StealthPayment = {
          txId: utxo.txId,
          outputIndex: utxo.index,
          amountSompi: utxo.amount,
          oneTimeAddress: address,
          ephemeralPubkey,
          spendingKey: bytesToHex(oneTimePriv),
          timestamp: Date.now(),
          spent: false,
        };

        _pendingPayments.set(key, payment);
        found.push(payment);
      }
    } catch (e) {
      console.error(`[Stealth REST] Error scanning ${address}:`, e);
    }
  }

  if (found.length > 0) {
    await persistPayments();
    console.log(`[Stealth REST] Found ${found.length} new stealth payments`);
  }

  return found;
}

export async function scanForStealthPayments(
  _scanFromDaaScore?: bigint
): Promise<StealthPayment[]> {
  const keys = await loadStealthKeys();
  if (!keys) return [];
  
  // Get all watched addresses
  const addresses = Array.from(_watchedAddresses);
  if (addresses.length === 0) return [];
  
  const found: StealthPayment[] = [];
  
  // Check UTXOs for each address
  for (const address of addresses) {
    try {
      const utxos = await getUtxosInternal(address);
      
      for (const utxo of utxos) {
        const key = `${utxo.txId}:${utxo.index}`;
        if (_pendingPayments.has(key)) continue; // Already known
        
        // Get TX to check OP_RETURN
        const tx = await getTransactionInternal(utxo.txId);
        if (!tx) continue;
        
        const ephemeralPubkey = findEphemeralPubkey(tx);
        if (!ephemeralPubkey) continue;
        
        if (!verifyStealthPayment(keys, ephemeralPubkey, address)) continue;
        
        // Derive spending key
        const ephemeralPub = hexToBytes(ephemeralPubkey);
        const scanPriv = hexToBytes(keys.scanPrivateKey);
        const sharedSecret = deriveSharedSecret(scanPriv, ephemeralPub);
        const spendPriv = hexToBytes(keys.spendPrivateKey);
        const oneTimePriv = deriveOneTimePrivateKey(spendPriv, sharedSecret);
        
        const payment: StealthPayment = {
          txId: utxo.txId,
          outputIndex: utxo.index,
          amountSompi: utxo.amount,
          oneTimeAddress: address,
          ephemeralPubkey,
          spendingKey: bytesToHex(oneTimePriv),
          timestamp: Date.now(),
          spent: false,
        };
        
        _pendingPayments.set(key, payment);
        found.push(payment);
      }
    } catch (e) {
      console.error(`[Stealth] Error scanning ${address}:`, e);
    }
  }
  
  if (found.length > 0) {
    await persistPayments();
    console.log(`[Stealth] Found ${found.length} new stealth payments`);
  }
  
  return found;
}

// ============================================================================
// INTEGRATION WITH WALLET REGISTRATION
// ============================================================================

/**
 * Initialize stealth keys during wallet registration
 * Call this after BIP39 seed is derived
 */
export async function initializeStealthFromSeed(
  seed: Uint8Array
): Promise<StealthKeys> {
  return generateStealthKeys(seed);
}

/**
 * Get stealth meta address for QR code / sharing
 * Format that can be parsed by senders
 */
export async function getStealthPaymentCode(): Promise<string | null> {
  const meta = await getStealthMetaAddress();
  if (!meta) return null;
  return `stealth:${meta}`;
}

/**
 * Parse stealth payment code
 */
export function parseStealthPaymentCode(code: string): {
  scanPubkey: string;
  spendPubkey: string;
} | null {
  if (!code.startsWith('stealth:')) return null;
  const parts = code.slice(8).split(':');
  if (parts.length !== 2) return null;
  return {
    scanPubkey: parts[0],
    spendPubkey: parts[1],
  };
}

// ============================================================================
// STEALTH METADATA BACKUP TO ARWEAVE (encrypted)
// ============================================================================

/**
 * Backup stealth metadata to Arweave (encrypted with main wallet pubkey).
 * Does NOT backup private keys — those are derived from BIP39 mnemonic.
 * Backs up: payment index, R values, watched addresses.
 * Recovery: mnemonic → derive keys → decrypt Arweave metadata → rederive stealth addresses
 */
export async function backupStealthMetadataToArweave(): Promise<string | null> {
  try {
    // Gather metadata (NOT private keys)
    const scanPub = await SecureStore.getItemAsync(SECURESTORE_KEYS.STEALTH_SCAN_PUB);
    const spendPub = await SecureStore.getItemAsync(SECURESTORE_KEYS.STEALTH_SPEND_PUB);
    const payments = await AsyncStorage.getItem(SECURESTORE_KEYS.STEALTH_PAYMENTS);
    const watched = await AsyncStorage.getItem(SECURESTORE_KEYS.WATCHED_ADDRESSES);

    if (!scanPub || !spendPub) {
      console.log('[Stealth] No stealth keys to backup');
      return null;
    }

    const metadata = {
      v: 'KV_STEALTH_BACKUP_V1',
      scanPub,
      spendPub,
      paymentCount: payments ? JSON.parse(payments).length : 0,
      // R values from payments (needed to rederive one-time addresses)
      rValues: payments ? JSON.parse(payments).map((p: any) => ({
        ephemeralPub: p.ephemeralPub || p.R,
        stealthAddress: p.stealthAddress || p.address,
        txId: p.txId,
        index: p.derivationIndex,
      })) : [],
      watchedAddresses: watched ? JSON.parse(watched) : [],
      timestamp: Date.now(),
    };

    // Encrypt metadata with scan pubkey (only owner can decrypt with scan_priv)
    // Simple XOR encryption with SHA256 key stream from scan_pub
    const { sha256 } = await import('@noble/hashes/sha256');
    const { bytesToHex } = await import('@noble/hashes/utils');
    const plaintext = new TextEncoder().encode(JSON.stringify(metadata));
    const keyStream = sha256(new TextEncoder().encode('KV_STEALTH_ENCRYPT:' + scanPub));
    const encrypted = new Uint8Array(plaintext.length);
    for (let i = 0; i < plaintext.length; i++) {
      encrypted[i] = plaintext[i] ^ keyStream[i % keyStream.length];
    }
    const encryptedHex = Array.from(encrypted).map(b => b.toString(16).padStart(2, '0')).join('');

    const tags = [
      { name: 'App-Name', value: 'KasVillage' },
      { name: 'Content-Type', value: 'application/octet-stream' },
      { name: 'KV-Type', value: 'stealth-backup-v1' },
      { name: 'KV-ScanPub', value: scanPub },
      { name: 'KV-Encrypted', value: 'true' },
      { name: 'Unix-Time', value: String(Math.floor(Date.now() / 1000)) },
    ];

    const result = await uploadToIrys(encryptedHex, tags);
    if (result.success) {
      console.log('[Stealth] Metadata backed up to Arweave:', result.txId);
      return result.txId || null;
    }
    return null;
  } catch (e) {
    console.warn('[Stealth] Arweave backup failed (non-fatal):', e);
    return null;
  }
}
