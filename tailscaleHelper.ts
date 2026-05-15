// TailscaleHelper.ts
// Production-ready Tailscale detection + Bluetooth P2P IOU ledger transfer

import { Linking, Platform, PermissionsAndroid } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import * as secp from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { IOULedger } from './IOUBalanceSheetShare';

// Wire HMAC for @noble/secp256k1 v2
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { hmac } = require('@noble/hashes/hmac') as { hmac: (h: unknown, k: Uint8Array, m: Uint8Array) => Uint8Array };
  (secp as any).etc.hmacSha256Sync = (key: Uint8Array, ...msgs: Uint8Array[]) => {
    const total = msgs.reduce((n, m) => n + m.length, 0);
    const cat = new Uint8Array(total);
    let off = 0; for (const m of msgs) { cat.set(m, off); off += m.length; }
    return hmac(sha256, key, cat);
  };
} catch {}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
function strToB64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = ''; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function b64ToStr(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
function u8ToB64(bytes: Uint8Array): string {
  let bin = ''; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function b64ToU8(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function randomU8(n: number): Uint8Array {
  const buf = new Uint8Array(n);
  globalThis.crypto.getRandomValues(buf);
  return buf;
}

interface EncryptedPayload { ephemeralPub: string; iv: string; ciphertext: string; }

async function toFixedU8(u: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  // Ensures buffer is ArrayBuffer (not SharedArrayBuffer) for SubtleCrypto
  return new Uint8Array(u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength)) as Uint8Array<ArrayBuffer>;
}

async function deriveAesKey(sharedSecret: Uint8Array): Promise<CryptoKey> {
  const raw = await toFixedU8(sha256(sharedSecret.slice(1)));
  return globalThis.crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']) as Promise<CryptoKey>;
}

async function encryptForRecipient(data: string, recipientPubkeyHex: string): Promise<EncryptedPayload> {
  const ephemeralPriv = (secp as any).utils?.randomPrivateKey?.() as Uint8Array | undefined ?? randomU8(32);
  const ephemeralPub = (secp as any).getPublicKey(ephemeralPriv, true) as Uint8Array;
  const recipientPub = hexToBytes(recipientPubkeyHex);
  const sharedPoint = (secp as any).getSharedSecret
    ? ((secp as any).getSharedSecret(ephemeralPriv, recipientPub) as Uint8Array)
    : sha256(new Uint8Array([...ephemeralPriv, ...recipientPub]));
  const aesKey = await deriveAesKey(sharedPoint);
  const iv = await toFixedU8(randomU8(12));
  const cipherBuf: ArrayBuffer = await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, await toFixedU8(new TextEncoder().encode(data)));
  return { ephemeralPub: bytesToHex(ephemeralPub), iv: u8ToB64(iv), ciphertext: u8ToB64(new Uint8Array(cipherBuf)) };
}

async function decryptWithPrivateKey(payload: EncryptedPayload, privateKeyHex: string): Promise<string> {
  const privateKey = hexToBytes(privateKeyHex);
  const ephemeralPub = hexToBytes(payload.ephemeralPub);
  const sharedPoint = (secp as any).getSharedSecret
    ? ((secp as any).getSharedSecret(privateKey, ephemeralPub) as Uint8Array)
    : sha256(new Uint8Array([...privateKey, ...ephemeralPub]));
  const aesKey = await deriveAesKey(sharedPoint);
  const plainBuf: ArrayBuffer = await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv: await toFixedU8(b64ToU8(payload.iv)) }, aesKey, await toFixedU8(b64ToU8(payload.ciphertext)));
  return new TextDecoder().decode(plainBuf);
}

const BLE_SERVICE_UUID = '6b617376-696c-6c61-6765-626c6e630001';
const BLE_CHAR_DATA_UUID = '6b617376-696c-6c61-6765-626c6e630002';
const BLE_CHAR_CTRL_UUID = '6b617376-696c-6c61-6765-626c6e630003';
const BLE_MTU = 512;
const BLE_CHUNK_SIZE = BLE_MTU - 3;
const SCAN_TIMEOUT_MS = 15000;
const CONNECT_TIMEOUT_MS = 10000;
const TRANSFER_TIMEOUT_MS = 60000;

export class TailscaleHelper {
  static async getTailscaleIP(): Promise<string | null> {
    try {
      try { const ip = await require('react-native-network-info').getIPV4Address(); if (ip && this.isTailscaleIP(ip)) return ip; } catch {}
      try { const state = await require('@react-native-community/netinfo').default.fetch(); const ip = state.details?.ipAddress; if (ip && this.isTailscaleIP(ip)) return ip; } catch {}
      try { const resp = await fetch('http://100.100.100.100/localapi/v0/status', { headers: { Accept: 'application/json' } }); if (resp.ok) { const data = await resp.json(); const selfIP = data?.Self?.TailscaleIPs?.[0]; if (selfIP && this.isTailscaleIP(selfIP)) return selfIP; } } catch {}
      return null;
    } catch { return null; }
  }
  static isTailscaleIP(ip: string): boolean {
    const parts = ip.split('.').map(Number);
    return parts.length === 4 && parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127;
  }
  static async isInstalled(): Promise<boolean> {
    try { return await Linking.canOpenURL(Platform.OS === 'ios' ? 'tailscale://' : 'com.tailscale.ipn://'); } catch { return false; }
  }
  static async openTailscaleApp(): Promise<void> {
    const installed = await this.isInstalled();
    await Linking.openURL(installed ? (Platform.OS === 'ios' ? 'tailscale://' : 'com.tailscale.ipn://') : Platform.select({ ios: 'https://apps.apple.com/app/tailscale/id1470499037', android: 'https://play.google.com/store/apps/details?id=com.tailscale.ipn', default: 'https://tailscale.com/download' })!);
  }
  static openInstallPage(): void { Linking.openURL(Platform.select({ ios: 'https://apps.apple.com/app/tailscale/id1470499037', android: 'https://play.google.com/store/apps/details?id=com.tailscale.ipn', default: 'https://tailscale.com/download' })!); }
  static getSetupInstructions(): string[] {
    return ['1. Install Tailscale on both phones', '2. Create free account', '3. Tap "Connect"', '4. Both devices join your mesh network', '5. Share IOU ledgers P2P — zero relay'];
  }
}

async function requestBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS === 'ios') return true;
  if (Platform.OS === 'android') {
    const apiLevel = Platform.Version as number;
    if (apiLevel >= 31) {
      const granted = await PermissionsAndroid.requestMultiple([PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT, PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE]);
      return Object.values(granted).every(v => v === 'granted');
    }
    return (await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, { title: 'Location for Bluetooth', message: 'KasVillage needs location to discover nearby devices.', buttonPositive: 'OK' })) === 'granted';
  }
  return false;
}

export interface BluetoothPeer { id: string; name: string; rssi: number; pubkey?: string; }
export interface TransferProgress { phase: 'init' | 'permissions' | 'scanning' | 'connecting' | 'encrypting' | 'sending' | 'receiving' | 'decrypting' | 'complete' | 'error'; progress: number; message: string; }
type ProgressCallback = (progress: TransferProgress) => void;

export class BluetoothBalanceTransfer {
  private bleManager: any = null;
  private peripheralManager: any = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (!await requestBluetoothPermissions()) throw new Error('Bluetooth permissions denied.');
    try {
      const { BleManager } = require('react-native-ble-plx');
      this.bleManager = new BleManager();
      try { this.peripheralManager = require('react-native-ble-peripheral').default; } catch {}
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('Bluetooth not ready')), 5000);
        const sub = this.bleManager.onStateChange((state: string) => {
          if (state === 'PoweredOn') { clearTimeout(t); sub.remove(); resolve(); }
          else if (state === 'PoweredOff' || state === 'Unauthorized') { clearTimeout(t); sub.remove(); reject(new Error(`Bluetooth ${state}`)); }
        }, true);
      });
      this.isInitialized = true;
    } catch (e: any) { throw new Error(`Bluetooth init failed: ${e.message}`); }
  }

  async scanForPeers(timeoutMs = SCAN_TIMEOUT_MS): Promise<BluetoothPeer[]> {
    await this.initialize();
    const peers = new Map<string, BluetoothPeer>();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { this.bleManager.stopDeviceScan(); resolve(Array.from(peers.values()).sort((a, b) => b.rssi - a.rssi)); }, timeoutMs);
      this.bleManager.startDeviceScan([BLE_SERVICE_UUID], { allowDuplicates: false }, (error: any, device: any) => {
        if (error) { clearTimeout(timeout); this.bleManager.stopDeviceScan(); reject(new Error(`Scan failed: ${error.message}`)); return; }
        if (device?.manufacturerData) {
          try {
            const bin = atob(device.manufacturerData);
            if (bin.length >= 35) {
              peers.set(device.id, { id: device.id, name: device.localName || device.name || 'KasVillage User', rssi: device.rssi ?? -100, pubkey: bytesToHex(Uint8Array.from(bin.slice(2, 35), (c: string) => c.charCodeAt(0))) });
            }
          } catch {}
        }
      });
    });
  }

  async sendLedger(peer: BluetoothPeer, ledger: IOULedger, recipientPubkey: string, onProgress: ProgressCallback): Promise<void> {
    await this.initialize();
    onProgress({ phase: 'encrypting', progress: 5, message: 'Encrypting...' });
    const payload = JSON.stringify(await encryptForRecipient(JSON.stringify(ledger), recipientPubkey));
    onProgress({ phase: 'connecting', progress: 10, message: 'Connecting...' });
    let device: any = null; let retries = 3;
    while (retries > 0 && !device) {
      try { device = await Promise.race([this.bleManager.connectToDevice(peer.id, { requestMTU: BLE_MTU }), new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout')), CONNECT_TIMEOUT_MS))]); }
      catch (e: any) { retries--; if (retries === 0) throw new Error(`Connection failed: ${e.message}`); await this.delay(1000); }
    }
    try {
      await device.discoverAllServicesAndCharacteristics();
      if (Platform.OS === 'android') { try { await device.requestMTU(BLE_MTU); } catch {} }
      onProgress({ phase: 'sending', progress: 20, message: 'Sending...' });
      const chunks = this.chunkPayload(payload);
      await this.writeWithRetry(device, BLE_CHAR_CTRL_UUID, this.encodeControl({ totalChunks: chunks.length }));
      for (let i = 0; i < chunks.length; i++) {
        await this.writeWithRetry(device, BLE_CHAR_DATA_UUID, chunks[i]);
        onProgress({ phase: 'sending', progress: 20 + Math.floor(((i + 1) / chunks.length) * 75), message: `Sending ${i + 1}/${chunks.length}...` });
      }
      await this.writeWithRetry(device, BLE_CHAR_CTRL_UUID, this.encodeControl({ complete: true }));
      onProgress({ phase: 'complete', progress: 100, message: 'Sent!' });
    } finally { try { await device.cancelConnection(); } catch {} }
  }

  // backward compat aliases
  async sendBalanceSheet(peer: BluetoothPeer, ledger: IOULedger, recipientPubkey: string, onProgress: ProgressCallback): Promise<void> { return this.sendLedger(peer, ledger, recipientPubkey, onProgress); }

  async receiveLedger(myPubkey: string, myPrivateKey: string, onProgress: ProgressCallback): Promise<IOULedger> {
    await this.initialize();
    onProgress({ phase: 'init', progress: 5, message: 'Starting...' });
    if (this.peripheralManager) return this.receiveAsPeripheral(myPubkey, myPrivateKey, onProgress);
    return this.receiveAsCentral(myPrivateKey, onProgress);
  }

  async receiveBalanceSheet(myPubkey: string, myPrivateKey: string, onProgress: ProgressCallback): Promise<IOULedger> { return this.receiveLedger(myPubkey, myPrivateKey, onProgress); }

  private async receiveAsPeripheral(myPubkey: string, myPrivateKey: string, onProgress: ProgressCallback): Promise<IOULedger> {
    const pm = this.peripheralManager;
    await pm.addService(BLE_SERVICE_UUID, true);
    await pm.addCharacteristic(BLE_SERVICE_UUID, BLE_CHAR_DATA_UUID, 16 | 2, 1);
    await pm.addCharacteristic(BLE_SERVICE_UUID, BLE_CHAR_CTRL_UUID, 16 | 2, 1);
    onProgress({ phase: 'scanning', progress: 10, message: 'Advertising...' });
    await pm.startAdvertising({ name: 'KasVillage', serviceUuids: [BLE_SERVICE_UUID], manufacturerData: [0xFF, 0xFF, ...hexToBytes(myPubkey)] });
    return new Promise((resolve, reject) => {
      const chunks: string[] = []; let expectedChunks = 0; let complete = false;
      const timeout = setTimeout(() => { pm.stopAdvertising(); reject(new Error('Transfer timeout')); }, TRANSFER_TIMEOUT_MS);
      pm.onWriteRequest((_deviceId: string, charUuid: string, value: string) => {
        if (charUuid === BLE_CHAR_CTRL_UUID) { const ctrl = this.decodeControl(value); if (ctrl.totalChunks) expectedChunks = ctrl.totalChunks; if (ctrl.complete) complete = true; }
        else if (charUuid === BLE_CHAR_DATA_UUID) { chunks.push(value); onProgress({ phase: 'receiving', progress: 20 + Math.floor((chunks.length / Math.max(expectedChunks, 1)) * 70), message: `Receiving ${chunks.length}/${expectedChunks || '?'}...` }); }
        if (complete && chunks.length === expectedChunks) {
          clearTimeout(timeout); pm.stopAdvertising();
          onProgress({ phase: 'decrypting', progress: 95, message: 'Decrypting...' });
          decryptWithPrivateKey(JSON.parse(b64ToStr(chunks.join(''))) as EncryptedPayload, myPrivateKey)
            .then(plain => { onProgress({ phase: 'complete', progress: 100, message: 'Received!' }); resolve(JSON.parse(plain) as IOULedger); })
            .catch((e: unknown) => reject(new Error(`Decryption failed: ${(e as Error).message}`)));
        }
      });
    });
  }

  private async receiveAsCentral(myPrivateKey: string, onProgress: ProgressCallback): Promise<IOULedger> {
    onProgress({ phase: 'scanning', progress: 10, message: 'Scanning...' });
    const peers = await this.scanForPeers(SCAN_TIMEOUT_MS);
    if (peers.length === 0) throw new Error('No senders found');
    onProgress({ phase: 'connecting', progress: 20, message: `Found ${peers[0].name}` });
    const device = await this.bleManager.connectToDevice(peers[0].id);
    await device.discoverAllServicesAndCharacteristics();
    return new Promise((resolve, reject) => {
      const chunks: string[] = []; let expectedChunks = 0;
      const timeout = setTimeout(async () => { await device.cancelConnection(); reject(new Error('Transfer timeout')); }, TRANSFER_TIMEOUT_MS);
      device.monitorCharacteristicForService(BLE_SERVICE_UUID, BLE_CHAR_DATA_UUID, (_err: unknown, char: any) => {
        if (char?.value) { chunks.push(char.value); onProgress({ phase: 'receiving', progress: 20 + Math.floor((chunks.length / Math.max(expectedChunks, 1)) * 70), message: `Receiving ${chunks.length}...` }); }
      });
      device.monitorCharacteristicForService(BLE_SERVICE_UUID, BLE_CHAR_CTRL_UUID, async (_err: unknown, char: any) => {
        if (!char?.value) return;
        const ctrl = this.decodeControl(char.value);
        if (ctrl.totalChunks) expectedChunks = ctrl.totalChunks;
        if (ctrl.complete) {
          clearTimeout(timeout); await device.cancelConnection();
          onProgress({ phase: 'decrypting', progress: 95, message: 'Decrypting...' });
          try { resolve(JSON.parse(await decryptWithPrivateKey(JSON.parse(b64ToStr(chunks.join(''))) as EncryptedPayload, myPrivateKey)) as IOULedger); onProgress({ phase: 'complete', progress: 100, message: 'Received!' }); }
          catch (e: unknown) { reject(new Error(`Decryption failed: ${(e as Error).message}`)); }
        }
      });
    });
  }

  private async writeWithRetry(device: any, charUuid: string, value: string, maxRetries = 3): Promise<void> {
    let lastError: Error | null = null;
    for (let i = 0; i < maxRetries; i++) { try { await device.writeCharacteristicWithResponseForService(BLE_SERVICE_UUID, charUuid, value); return; } catch (e: any) { lastError = e; await this.delay(100 * (i + 1)); } }
    throw lastError || new Error('Write failed');
  }
  private chunkPayload(p: string): string[] { const e = strToB64(p); const c: string[] = []; for (let i = 0; i < e.length; i += BLE_CHUNK_SIZE) c.push(e.slice(i, i + BLE_CHUNK_SIZE)); return c; }
  private encodeControl(ctrl: { totalChunks?: number; complete?: boolean }): string { return strToB64(JSON.stringify(ctrl)); }
  private decodeControl(v: string): { totalChunks?: number; complete?: boolean } { try { return JSON.parse(b64ToStr(v)); } catch { return {}; } }
  private delay(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }
  cleanup(): void { try { this.bleManager?.stopDeviceScan(); this.bleManager?.destroy(); this.peripheralManager?.stopAdvertising(); } catch {} this.bleManager = null; this.peripheralManager = null; this.isInitialized = false; }
}

export async function getLocalIP(): Promise<string | null> {
  try { return await require('react-native-network-info').getIPV4Address(); } catch {}
  try { return (await require('@react-native-community/netinfo').default.fetch()).details?.ipAddress || null; } catch {}
  return null;
}

export class LocalP2PServer {
  private port: number;
  private server: any = null;
  private ledger: IOULedger | null = null;
  constructor(port = 8787) { this.port = port; }
  async start(): Promise<void> {
    try {
      const httpBridge = require('react-native-http-bridge');
      httpBridge.start(this.port, 'KasVillage', (req: any) => {
        if (req.url.startsWith('/sheet/') && this.ledger) httpBridge.respond(req.requestId, 200, 'application/json', JSON.stringify(this.ledger));
        else httpBridge.respond(req.requestId, 404, 'text/plain', 'Not found');
      });
      this.server = httpBridge;
    } catch (e: any) { throw new Error(`Server failed: ${e.message}`); }
  }
  setBalanceSheet(ledger: IOULedger): void { this.ledger = ledger; }
  setLedger(ledger: IOULedger): void { this.ledger = ledger; }
  stop(): void { try { this.server?.stop(); } catch {} this.server = null; this.ledger = null; }
}

export function useTailscaleStatus() {
  const [ip, setIP] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const refresh = useCallback(async () => { setChecking(true); setIP(await TailscaleHelper.getTailscaleIP()); setChecking(false); }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { ip, isConnected: !!ip, checking, refresh };
}

export function useBluetoothTransfer() {
  const [transfer] = useState(() => new BluetoothBalanceTransfer());
  const [progress, setProgress] = useState<TransferProgress | null>(null);
  useEffect(() => () => transfer.cleanup(), [transfer]);
  const scan = useCallback(async () => {
    setProgress({ phase: 'scanning', progress: 0, message: 'Scanning...' });
    try { const peers = await transfer.scanForPeers(); setProgress(null); return peers; }
    catch (e: any) { setProgress({ phase: 'error', progress: 0, message: e.message }); throw e; }
  }, [transfer]);
  const send = useCallback(async (peer: BluetoothPeer, ledger: IOULedger, recipientPubkey: string) => { await transfer.sendLedger(peer, ledger, recipientPubkey, setProgress); }, [transfer]);
  const receive = useCallback(async (myPubkey: string, myPrivateKey: string) => transfer.receiveLedger(myPubkey, myPrivateKey, setProgress), [transfer]);
  return { scan, send, receive, progress, cleanup: () => transfer.cleanup() };
}

export default TailscaleHelper;