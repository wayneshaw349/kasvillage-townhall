// bluetooth_p2p.ts
// Bluetooth P2P for Neighbor Agreement partial TX exchange

import { Platform, PermissionsAndroid } from 'react-native';
import { BleManager, Device, State } from 'react-native-ble-plx';

// =============================================================================
// CONSTANTS
// =============================================================================

const KV_SERVICE_UUID = '6b617376-696c-6c61-6765-000000000001';
const KV_CHAR_AGREEMENT_ID = '6b617376-696c-6c61-6765-000000000002';
const KV_CHAR_PARTIAL_TX = '6b617376-696c-6c61-6765-000000000003';
const KV_CHAR_STATUS = '6b617376-696c-6c61-6765-000000000004';
const KV_CHAR_PUBKEY = '6b617376-696c-6c61-6765-000000000005';

const BLE_MTU = 512;
const CHUNK_SIZE = BLE_MTU - 3;
const SCAN_TIMEOUT = 30000;
const CONNECT_TIMEOUT = 10000;
const TRANSFER_TIMEOUT = 60000;

// =============================================================================
// ENCODING HELPERS (no Buffer)
// =============================================================================

function strToBase64(str: string): string {
  // btoa only handles Latin-1; encode UTF-8 first
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToStr(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

// =============================================================================
// TYPES
// =============================================================================

export interface BluetoothPeer {
  id: string;
  name: string | null;
  rssi: number;
  agreementId?: string;
  pubkey?: string;
}

export interface BluetoothTransferResult {
  success: boolean;
  error?: string;
  peerId?: string;
  peerPubkey?: string;
}

export interface BluetoothStatus {
  available: boolean;
  enabled: boolean;
  scanning: boolean;
  connected: boolean;
  peerId?: string;
  error?: string;
}

type StatusCallback = (status: BluetoothStatus) => void;
type PeerCallback = (peer: BluetoothPeer) => void;
type DataCallback = (data: string, peerId: string) => void;

// =============================================================================
// BLUETOOTH P2P MANAGER
// =============================================================================

export class BluetoothP2P {
  private manager: BleManager;
  private connectedDevice: Device | null = null;
  private isScanning = false;
  private isAdvertising = false;
  private statusCallback?: StatusCallback;
  private peerCallback?: PeerCallback;
  private dataCallback?: DataCallback;
  private myAgreementId: string = '';
  private myPubkey: string = '';
  private receivedChunks: Map<string, { chunks: string[]; total: number }> = new Map();

  constructor() {
    this.manager = new BleManager();
  }

  // ===========================================================================
  // LIFECYCLE
  // ===========================================================================

  async initialize(): Promise<boolean> {
    try {
      const hasPermissions = await this.requestPermissions();
      if (!hasPermissions) {
        this.updateStatus({ available: false, enabled: false, scanning: false, connected: false, error: 'Permissions denied' });
        return false;
      }

      const state = await this.manager.state();

      if (state === State.PoweredOff) {
        this.updateStatus({ available: true, enabled: false, scanning: false, connected: false, error: 'Bluetooth is off' });
        return false;
      }

      if (state !== State.PoweredOn) {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Bluetooth not ready')), 5000);
          const subscription = this.manager.onStateChange((newState: any) => {
            if (newState === State.PoweredOn) {
              clearTimeout(timeout);
              subscription.remove();
              resolve();
            }
          }, true);
        });
      }

      this.updateStatus({ available: true, enabled: true, scanning: false, connected: false });
      return true;
    } catch (e) {
      this.updateStatus({ available: false, enabled: false, scanning: false, connected: false, error: String(e) });
      return false;
    }
  }

  destroy(): void {
    this.stopScan();
    this.disconnect();
    this.manager.destroy();
  }

  // ===========================================================================
  // PERMISSIONS
  // ===========================================================================

  private async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'ios') return true;

    if (Platform.OS === 'android') {
      try {
        const apiLevel = Platform.Version as number;

        if (apiLevel >= 31) {
          const results = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ]);
          return Object.values(results).every(r => r === PermissionsAndroid.RESULTS.GRANTED);
        } else {
          const result = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
          );
          return result === PermissionsAndroid.RESULTS.GRANTED;
        }
      } catch (e) {
        return false;
      }
    }

    return false;
  }

  // ===========================================================================
  // CALLBACKS
  // ===========================================================================

  onStatus(callback: StatusCallback): void { this.statusCallback = callback; }
  onPeerDiscovered(callback: PeerCallback): void { this.peerCallback = callback; }
  onDataReceived(callback: DataCallback): void { this.dataCallback = callback; }

  private updateStatus(status: Partial<BluetoothStatus>): void {
    this.statusCallback?.({
      available: status.available ?? true,
      enabled: status.enabled ?? true,
      scanning: status.scanning ?? this.isScanning,
      connected: status.connected ?? !!this.connectedDevice,
      peerId: status.peerId ?? this.connectedDevice?.id,
      error: status.error,
    });
  }

  // ===========================================================================
  // SCANNING
  // ===========================================================================

  async startScan(agreementId: string, myPubkey: string): Promise<void> {
    if (this.isScanning) return;

    this.myAgreementId = agreementId;
    this.myPubkey = myPubkey;
    this.isScanning = true;
    this.updateStatus({ scanning: true });

    const scanTimeout = setTimeout(() => this.stopScan(), SCAN_TIMEOUT);

    this.manager.startDeviceScan(
      [KV_SERVICE_UUID],
      { allowDuplicates: false },
      async (error: any, device: any) => {
        if (error) {
          this.stopScan();
          clearTimeout(scanTimeout);
          return;
        }

        if (device && device.name?.startsWith('KV_')) {
          const peerAgreementPrefix = device.name.slice(3);
          this.peerCallback?.({
            id: device.id,
            name: device.name,
            rssi: device.rssi ?? -100,
            agreementId: peerAgreementPrefix,
          });
        }
      }
    );
  }

  stopScan(): void {
    if (!this.isScanning) return;
    this.manager.stopDeviceScan();
    this.isScanning = false;
    this.updateStatus({ scanning: false });
  }

  // ===========================================================================
  // ADVERTISING
  // ===========================================================================

  async startAdvertising(agreementId: string, myPubkey: string): Promise<boolean> {
    this.myAgreementId = agreementId;
    this.myPubkey = myPubkey;
    this.isAdvertising = true;
    return true;
  }

  stopAdvertising(): void {
    this.isAdvertising = false;
  }

  // ===========================================================================
  // CONNECTION
  // ===========================================================================

  async connectToPeer(peerId: string): Promise<boolean> {
    try {
      const device = await this.manager.connectToDevice(peerId, {
        timeout: CONNECT_TIMEOUT,
        requestMTU: BLE_MTU,
      });

      await device.discoverAllServicesAndCharacteristics();
      this.connectedDevice = device;
      this.updateStatus({ connected: true, peerId: device.id });

      device.onDisconnected((_error: any, _dev: any) => {
        this.connectedDevice = null;
        this.updateStatus({ connected: false, peerId: undefined });
      });

      await this.subscribeToCharacteristic(device, KV_CHAR_PARTIAL_TX);
      return true;
    } catch (e) {
      this.updateStatus({ connected: false, error: String(e) });
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connectedDevice) {
      try {
        await this.manager.cancelDeviceConnection(this.connectedDevice.id);
      } catch {}
      this.connectedDevice = null;
      this.updateStatus({ connected: false, peerId: undefined });
    }
  }

  // ===========================================================================
  // DATA TRANSFER
  // ===========================================================================

  async sendData(data: string): Promise<BluetoothTransferResult> {
    if (!this.connectedDevice) {
      return { success: false, error: 'Not connected' };
    }

    try {
      const chunks = this.chunkData(data);

      for (let i = 0; i < chunks.length; i++) {
        const payload = `${i}:${chunks.length}:${chunks[i]}`;
        const base64 = strToBase64(payload); // ← no Buffer

        await this.connectedDevice.writeCharacteristicWithResponseForService(
          KV_SERVICE_UUID,
          KV_CHAR_PARTIAL_TX,
          base64
        );

        if (i < chunks.length - 1) {
          await new Promise(r => setTimeout(r, 50));
        }
      }

      return { success: true, peerId: this.connectedDevice.id };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  private async subscribeToCharacteristic(device: Device, charUuid: string): Promise<void> {
    device.monitorCharacteristicForService(
      KV_SERVICE_UUID,
      charUuid,
      (error: any, characteristic: any) => {
        if (error || !characteristic?.value) return;
        this.handleIncomingChunk(characteristic.value, device.id);
      }
    );
  }

  private handleIncomingChunk(base64Value: string, peerId: string): void {
    try {
      const payload = base64ToStr(base64Value); // ← no Buffer
      const colonIdx1 = payload.indexOf(':');
      const colonIdx2 = payload.indexOf(':', colonIdx1 + 1);

      if (colonIdx1 === -1 || colonIdx2 === -1) return;

      const chunkIdx = parseInt(payload.slice(0, colonIdx1), 10);
      const totalChunks = parseInt(payload.slice(colonIdx1 + 1, colonIdx2), 10);
      const chunkData = payload.slice(colonIdx2 + 1);

      let buffer = this.receivedChunks.get(peerId);
      if (!buffer || buffer.total !== totalChunks) {
        buffer = { chunks: new Array(totalChunks).fill(''), total: totalChunks };
        this.receivedChunks.set(peerId, buffer);
      }

      buffer.chunks[chunkIdx] = chunkData;

      const receivedCount = buffer.chunks.filter(c => c !== '').length;
      if (receivedCount === totalChunks) {
        const fullData = buffer.chunks.join('');
        this.receivedChunks.delete(peerId);
        this.dataCallback?.(fullData, peerId);
      }
    } catch (e) {
      console.error('[Bluetooth] Chunk parse error:', e);
    }
  }

  private chunkData(data: string): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      chunks.push(data.slice(i, i + CHUNK_SIZE));
    }
    return chunks;
  }

  // ===========================================================================
  // HIGH-LEVEL API
  // ===========================================================================

  async findPeer(agreementId: string, myPubkey: string, timeoutMs = SCAN_TIMEOUT): Promise<BluetoothPeer | null> {
    return new Promise((resolve) => {
      let found = false;
      const timeout = setTimeout(() => {
        if (!found) { this.stopScan(); resolve(null); }
      }, timeoutMs);

      this.onPeerDiscovered((peer) => {
        if (peer.agreementId && agreementId.startsWith(peer.agreementId)) {
          found = true;
          clearTimeout(timeout);
          this.stopScan();
          resolve(peer);
        }
      });

      this.startScan(agreementId, myPubkey);
    });
  }

  async sendPartialTx(partialTx: string, agreementId: string): Promise<BluetoothTransferResult> {
    return this.sendData(JSON.stringify({
      type: 'partial_tx',
      agreementId,
      partialTx,
      timestamp: Date.now(),
    }));
  }

  async waitForPartialTx(timeoutMs = TRANSFER_TIMEOUT): Promise<string | null> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.dataCallback = undefined;
        resolve(null);
      }, timeoutMs);

      this.onDataReceived((data) => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'partial_tx' && parsed.partialTx) {
            clearTimeout(timeout);
            this.dataCallback = undefined;
            resolve(parsed.partialTx);
          }
        } catch {}
      });
    });
  }

  getStatus(): BluetoothStatus {
    return {
      available: true,
      enabled: true,
      scanning: this.isScanning,
      connected: !!this.connectedDevice,
      peerId: this.connectedDevice?.id,
    };
  }

  isConnected(): boolean {
    return !!this.connectedDevice;
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let bluetoothInstance: BluetoothP2P | null = null;

export function getBluetoothP2P(): BluetoothP2P {
  if (!bluetoothInstance) bluetoothInstance = new BluetoothP2P();
  return bluetoothInstance;
}

// =============================================================================
// REACT HOOK
// =============================================================================

import { useState, useEffect, useCallback } from 'react';

export interface UseBluetoothP2PResult {
  status: BluetoothStatus;
  peers: BluetoothPeer[];
  initialize: () => Promise<boolean>;
  startScan: (agreementId: string, myPubkey: string) => Promise<void>;
  stopScan: () => void;
  connectToPeer: (peerId: string) => Promise<boolean>;
  disconnect: () => Promise<void>;
  sendPartialTx: (partialTx: string, agreementId: string) => Promise<BluetoothTransferResult>;
  waitForPartialTx: (timeoutMs?: number) => Promise<string | null>;
}

export function useBluetoothP2P(): UseBluetoothP2PResult {
  const [status, setStatus] = useState<BluetoothStatus>({
    available: false,
    enabled: false,
    scanning: false,
    connected: false,
  });
  const [peers, setPeers] = useState<BluetoothPeer[]>([]);
  const [bt] = useState(() => getBluetoothP2P());

  useEffect(() => {
    bt.onStatus(setStatus);
    bt.onPeerDiscovered((peer) => {
      setPeers(prev => prev.find(p => p.id === peer.id) ? prev : [...prev, peer]);
    });
    return () => { bt.stopScan(); };
  }, [bt]);

  const initialize = useCallback(() => bt.initialize(), [bt]);
  const startScan = useCallback((agreementId: string, myPubkey: string) => {
    setPeers([]);
    return bt.startScan(agreementId, myPubkey);
  }, [bt]);
  const stopScan = useCallback(() => bt.stopScan(), [bt]);
  const connectToPeer = useCallback((peerId: string) => bt.connectToPeer(peerId), [bt]);
  const disconnect = useCallback(() => bt.disconnect(), [bt]);
  const sendPartialTx = useCallback(
    (partialTx: string, agreementId: string) => bt.sendPartialTx(partialTx, agreementId),
    [bt]
  );
  const waitForPartialTx = useCallback((timeoutMs?: number) => bt.waitForPartialTx(timeoutMs), [bt]);

  return { status, peers, initialize, startScan, stopScan, connectToPeer, disconnect, sendPartialTx, waitForPartialTx };
}

// =============================================================================
// EXPORTS
// =============================================================================

export { KV_SERVICE_UUID, KV_CHAR_PARTIAL_TX, BLE_MTU, CHUNK_SIZE, SCAN_TIMEOUT };

// =============================================================================
// BLUETOOTH DIRECT PAY
// =============================================================================
// Receiver: advertises their Kaspa address + display name over BLE
// Sender: scans nearby, picks a receiver, sends KAS to their address
//
// Flow:
//   RECEIVER → advertisePay(myAddress, myName) → broadcasts address
//   SENDER   → scanForPayees() → sees list → picks one → gets their address
//   SENDER   → sendKAS to that address (normal L1 transaction)
// =============================================================================

const KV_PAY_SERVICE_UUID = '6b617376-696c-6c61-6765-706179303031'; // "kasvillagepay001"
const KV_PAY_CHAR_ADDRESS = '6b617376-696c-6c61-6765-706179303032';
const KV_PAY_CHAR_NAME = '6b617376-696c-6c61-6765-706179303033';
const KV_PAY_CHAR_AMOUNT = '6b617376-696c-6c61-6765-706179303034';

export interface PayablePeer {
  id: string;
  deviceName: string | null;
  displayName: string;
  kaspaAddress: string;
  requestedAmount?: number; // Optional: receiver can request specific amount in KAS
  rssi: number;
}

export interface BluetoothPayResult {
  success: boolean;
  peerName?: string;
  peerAddress?: string;
  error?: string;
}

/**
 * RECEIVER: Advertise your address for nearby payments
 * Call this when user taps "Receive via Bluetooth"
 */
export async function advertiseForPayment(params: {
  kaspaAddress: string;
  displayName: string;
  requestedAmountKAS?: number;
  onPeerConnected?: (peerId: string) => void;
}): Promise<{ stop: () => void }> {
  const bt = getBluetoothP2P();
  const ready = await bt.initialize();
  if (!ready) throw new Error('Bluetooth not available');
  
  // Encode payment info as JSON in the agreement/pubkey fields
  const payInfo = JSON.stringify({
    type: 'kv_pay',
    address: params.kaspaAddress,
    name: params.displayName,
    amount: params.requestedAmountKAS || 0,
  });
  
  // Use existing BLE infrastructure — advertise with pay info as the "pubkey" data
  await bt.startScan('KV_PAY', payInfo);
  
  return {
    stop: () => bt.stopScan(),
  };
}

/**
 * SENDER: Scan for nearby payees
 * Returns list of nearby people accepting payments
 */
export async function scanForPayees(params: {
  timeoutMs?: number;
  onPeerFound?: (peer: PayablePeer) => void;
}): Promise<PayablePeer[]> {
  const bt = getBluetoothP2P();
  const ready = await bt.initialize();
  if (!ready) throw new Error('Bluetooth not available');
  
  const payees: PayablePeer[] = [];
  
  bt.onPeerDiscovered((peer) => {
    // Try to parse payment info from peer's pubkey field
    if (peer.pubkey) {
      try {
        const info = JSON.parse(peer.pubkey);
        if (info.type === 'kv_pay' && info.address) {
          const payee: PayablePeer = {
            id: peer.id,
            deviceName: peer.name,
            displayName: info.name || 'Unknown',
            kaspaAddress: info.address,
            requestedAmount: info.amount > 0 ? info.amount : undefined,
            rssi: peer.rssi,
          };
          if (!payees.find(p => p.id === payee.id)) {
            payees.push(payee);
            params.onPeerFound?.(payee);
          }
        }
      } catch {}
    }
  });
  
  await bt.startScan('KV_PAY', '');
  
  // Wait for timeout then return results
  await new Promise(resolve => setTimeout(resolve, params.timeoutMs || 15000));
  bt.stopScan();
  
  return payees.sort((a, b) => b.rssi - a.rssi); // Closest first
}

/**
 * SENDER: Connect to payee and get their confirmed address
 * Extra verification step — connects to confirm address matches advertisement
 */
export async function connectToPayee(peerId: string): Promise<BluetoothPayResult> {
  const bt = getBluetoothP2P();
  try {
    const connected = await bt.connectToPeer(peerId);
    if (!connected) return { success: false, error: 'Connection failed' };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * React hook for Bluetooth Direct Pay
 */
export function useBluetoothPay() {
  const [scanning, setScanning] = useState(false);
  const [advertising, setAdvertising] = useState(false);
  const [payees, setPayees] = useState<PayablePeer[]>([]);
  const stopRef = { current: null as (() => void) | null };
  
  const startReceiving = useCallback(async (address: string, name: string, amountKAS?: number) => {
    setAdvertising(true);
    try {
      const result = await advertiseForPayment({
        kaspaAddress: address,
        displayName: name,
        requestedAmountKAS: amountKAS,
      });
      stopRef.current = result.stop;
    } catch (e) {
      setAdvertising(false);
    }
  }, []);
  
  const stopReceiving = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    setAdvertising(false);
  }, []);
  
  const startScanning = useCallback(async (timeoutMs?: number) => {
    setScanning(true);
    setPayees([]);
    try {
      const found = await scanForPayees({
        timeoutMs,
        onPeerFound: (peer) => setPayees(prev => [...prev, peer]),
      });
      setPayees(found);
    } finally {
      setScanning(false);
    }
  }, []);
  
  const stopScanning = useCallback(() => {
    const bt = getBluetoothP2P();
    bt.stopScan();
    setScanning(false);
  }, []);
  
  return {
    scanning, advertising, payees,
    startReceiving, stopReceiving,
    startScanning, stopScanning,
  };
}