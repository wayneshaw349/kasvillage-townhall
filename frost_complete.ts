




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
// KASPA SIGHASH � Blake2b-256 with TransactionSigningHash domain key
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
  // Use x-only (32 bytes) for P2PK address � looks like a normal Kaspa address
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
  return bytesToHex(hash).slice(0, 12).toUpperCase(); // 48-bit MITM grind cost
}

export function deriveFrostAddressLocal(params: {
  frostCounter?: number;
  pubkeyA: string;
  pubkeyB: string;
  network: KaspaNetwork;
  agreementId?: string;
}): FrostAddress {
  const { pubkeyA, pubkeyB, network, agreementId } = params;
  let frostCounter = params.frostCounter; // agrNonceDerived
  if (!(frostCounter && frostCounter > 0) && agreementId) {
    frostCounter = Number(BigInt('0x' + bytesToHex(sha256(new TextEncoder().encode(agreementId)))) % 2147483646n) + 1;
  }
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


export function aggregatePartialSigs(sigA: string, sigB: string): string {
  const sigABytes = hexToBytes(sigA);
  const sigBBytes = hexToBytes(sigB);

  if (sigABytes.length !== 64 || sigBBytes.length !== 64) {
    throw new Error('Invalid partial signature length');
  }

  // R_agg = R_A + R_B (EC point addition on secp256k1)
  // R is x-only (32 bytes) � lift to full point, add, compress back to x-only
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

  // BLE disabled until next EAS build
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






// ============================================================================
// SECTION 6: CLEANUP
// ============================================================================

export function cleanup(): void {
  try { bleManager?.stopDeviceScan(); bleManager?.destroy(); blePeripheral?.stopAdvertising(); wifiServer?.stop(); } catch {}
  bleManager = null; blePeripheral = null; wifiServer = null;
}


/** Validate escrow destination is standard P2PK, not a covenant. */
export async function validateEscrowDestination(
  address: string, network: KaspaNetwork = 'testnet-10'
): Promise<{ safe: boolean; reason?: string }> {
  const prefix = network === 'mainnet' ? 'kaspa:' : 'kaspatest:';
  if (!address.startsWith(prefix)) return { safe: false, reason: "Invalid address prefix" };
  const addrBody = address.slice(prefix.length);
  if (addrBody.startsWith('p')) {
    const api = network === 'mainnet' ? 'api.kaspa.org' : 'api-tn10.kaspa.org';
    try {
      const resp = await fetch(`https://${api}/addresses/${address}/utxos`);
      if (resp.ok) { for (const u of (await resp.json()) || []) {
        if ((u?.utxoEntry?.scriptPublicKey?.scriptPublicKey || '').length > 72)
          return { safe: false, reason: "Covenant script detected at destination" };
      }}
    } catch {}
    return { safe: true, reason: "P2SH address - verify this is your FROST aggregate key" };
  }
  return { safe: true };
}

export default {
  deriveFrostAddressLocal, deriveAggregatePubkey, aggregateToAddress, generateVerificationCode, verifyFrostAddress,
  aggregatePartialSigs,
  buildFrostInscription, parseFrostInscription, inscribeFrostEvent,
  generatePubkeyQR, parsePubkeyQR, scanForBlePeers, advertiseBleForFrost, exchangePubkeyViaBle,
  startWifiP2PServer, connectToWifiPeer, getTailscaleIP, isTailscaleFunnelAvailable,
  startTailscaleFunnel, openTailscaleApp, exchangeViaTownhall,
  exchangePubkeys, createFrostAgreement, cleanup,
};




