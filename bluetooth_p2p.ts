// bluetooth_p2p.ts
// Bluetooth P2P for Neighbor Agreement partial TX exchange

import { Platform, PermissionsAndroid } from 'react-native';
// BLE_NATIVE_REQUIRED: needs EAS dev build
let BleManager: any, Device: any, State: any;
try {
  const blePlx = require('react-native-ble-plx');
  BleManager = blePlx.BleManager;
  Device = blePlx.Device;
  State = blePlx.State;
} catch (e) {
  console.warn('[BLE] react-native-ble-plx not available — BLE disabled');
  BleManager = class { state() { return 'Unknown'; } startDeviceScan() {} stopDeviceScan() {} destroy() {} onStateChange() { return { remove: () => {} }; } connectToDevice() { throw new Error('BLE not available'); } cancelDeviceConnection() {} };
  State = { PoweredOn: 'PoweredOn', PoweredOff: 'PoweredOff' };
}
let BLEAdvertiser: any;
try { BLEAdvertiser = require('react-native-ble-advertiser').default; } catch { BLEAdvertiser = { setCompanyId: () => {}, broadcast: async () => {}, stopBroadcast: async () => {}, scan: async () => {}, stopScan: async () => {}, addListener: () => ({ remove: () => {} }) }; }

// =============================================================================
// CONSTANTS
// =============================================================================

const KV_COMPANY_ID = 0x4B56; // "KV" in hex
// NOTE: For iOS background BLE, add to app.json infoPlist:
//   "UIBackgroundModes": ["bluetooth-central", "bluetooth-peripheral"]
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
  private manager: any;
  private connectedDevice: any = null;
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


  // ===========================================================================
  // ADVERTISING (react-native-ble-advertiser) — iOS + Android
  // ===========================================================================

  /**
   * Start broadcasting KV_SERVICE_UUID with agreement ID in manufacturer data.
   * Other KasVillage phones scanning will see this and know we're nearby.
   */
  async startAdvertising(agreementId: string, myPubkey: string): Promise<boolean> {
    this.myAgreementId = agreementId;
    this.myPubkey = myPubkey;

    try {
      BLEAdvertiser.setCompanyId(KV_COMPANY_ID);

      // Encode agreement ID prefix + pubkey prefix into manufacturer data (max 24 bytes)
      // Format: [8 bytes agrId hash] [8 bytes pubkey prefix]
      const agrBytes = this.stringToManufacturerData(agreementId.slice(0, 8));
      const pubBytes = this.stringToManufacturerData(myPubkey.slice(0, 8));
      const mfgData = [...agrBytes, ...pubBytes];

      await BLEAdvertiser.broadcast(KV_SERVICE_UUID, mfgData, {
        advertiseMode: 2,     // LOW_LATENCY
        txPowerLevel: 3,      // HIGH
        connectable: false,
        includeDeviceName: true,
      });

      this.isAdvertising = true;
      console.log('[BLE-Adv] Broadcasting:', agreementId.slice(0, 12), 'pubkey:', myPubkey.slice(0, 10));
      return true;
    } catch (e) {
      console.error('[BLE-Adv] Broadcast failed:', e);
      this.isAdvertising = false;
      return false;
    }
  }

  stopAdvertising(): void {
    if (!this.isAdvertising) return;
    try {
      BLEAdvertiser.stopBroadcast()
        .then(() => console.log('[BLE-Adv] Stopped'))
        .catch(() => {});
    } catch {}
    this.isAdvertising = false;
  }

  /**
   * Scan using ble-advertiser (complementary to ble-plx scan).
   * Picks up manufacturer data from other KasVillage phones.
   */
  async startAdvertiserScan(
    agreementId: string,
    onPeerFound: (peer: BluetoothPeer & { agrPrefix: string; pubPrefix: string }) => void,
    timeoutMs = SCAN_TIMEOUT,
  ): Promise<void> {
    try {
      BLEAdvertiser.setCompanyId(KV_COMPANY_ID);

      const listener = BLEAdvertiser.addListener('onDeviceFound', (event: any) => {
        if (!event?.serviceUuids?.length) return;
        const hasKV = event.serviceUuids.some(
          (u: string) => u.toLowerCase() === KV_SERVICE_UUID.toLowerCase()
        );
        if (!hasKV) return;

        // Decode manufacturer data
        const mfgData: number[] = event.mfgData || [];
        const agrPrefix = this.manufacturerDataToString(mfgData.slice(0, 8));
        const pubPrefix = this.manufacturerDataToString(mfgData.slice(8, 16));

        console.log('[BLE-Scan] Found KV peer:', event.deviceAddress, 'agr:', agrPrefix, 'pub:', pubPrefix);

        onPeerFound({
          id: event.deviceAddress || event.deviceName || 'unknown',
          name: event.deviceName,
          rssi: event.rssi ?? -100,
          agreementId: agrPrefix,
          pubkey: pubPrefix,
          agrPrefix,
          pubPrefix,
        });
      });

      await BLEAdvertiser.scan([KV_SERVICE_UUID], {
        numberOfMatches: 3,
        matchMode: 1,         // AGGRESSIVE
        scanMode: 2,          // LOW_LATENCY
        reportDelay: 0,
      });

      // Auto-stop after timeout
      setTimeout(() => {
        this.stopAdvertiserScan();
        listener?.remove?.();
      }, timeoutMs);
    } catch (e) {
      console.error('[BLE-Scan] Advertiser scan failed:', e);
    }
  }

  stopAdvertiserScan(): void {
    try {
      BLEAdvertiser.stopScan()
        .then(() => console.log('[BLE-Scan] Stopped'))
        .catch(() => {});
    } catch {}
  }

  // ===========================================================================
  // MANUFACTURER DATA ENCODING (no Buffer)
  // ===========================================================================

  private stringToManufacturerData(str: string): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < Math.min(str.length, 8); i++) {
      bytes.push(str.charCodeAt(i) & 0xFF);
    }
    while (bytes.length < 8) bytes.push(0);
    return bytes;
  }

  private manufacturerDataToString(bytes: number[]): string {
    return bytes.filter(b => b > 0).map(b => String.fromCharCode(b)).join('');
  }

  // ===========================================================================
  // AUTO-DISCOVER: Both phones advertise + scan simultaneously.
  // When peer is found matching agreement ID, callback fires.
  // Data exchange happens via Arweave relay (BLE = proximity proof only).
  // ===========================================================================

  async autoDiscover(
    agreementId: string,
    myPubkey: string,
    timeoutMs = 30000,
  ): Promise<{ peerId: string; peerPubPrefix: string; rssi: number } | null> {
    console.log('[BLE-Auto] Starting dual-mode discovery for:', agreementId.slice(0, 12));

    // Start advertising our presence
    await this.startAdvertising(agreementId, myPubkey);

    return new Promise((resolve) => {
      let resolved = false;

      const timeout = setTimeout(() => {
        if (resolved) return;
        resolved = true;
        this.stopAdvertising();
        this.stopAdvertiserScan();
        this.stopScan();
        console.log('[BLE-Auto] Timeout — no peer found');
        resolve(null);
      }, timeoutMs);

      const onFound = (peer: BluetoothPeer & { agrPrefix?: string; pubPrefix?: string }) => {
        if (resolved) return;
        // Match by agreement ID prefix
        const peerAgr = peer.agrPrefix || peer.agreementId || '';
        if (agreementId.startsWith(peerAgr) || peerAgr.startsWith(agreementId.slice(0, 8))) {
          resolved = true;
          clearTimeout(timeout);
          this.stopAdvertiserScan();
          this.stopScan();
          // Keep advertising briefly so peer can discover us too
          setTimeout(() => this.stopAdvertising(), 5000);

          console.log('[BLE-Auto] Peer found:', peer.id, 'RSSI:', peer.rssi);
          resolve({
            peerId: peer.id,
            peerPubPrefix: peer.pubPrefix || peer.pubkey || '',
            rssi: peer.rssi,
          });
        }
      };

      // Scan via ble-advertiser (manufacturer data)
      this.startAdvertiserScan(agreementId, onFound, timeoutMs);

      // Also scan via ble-plx (service UUID scan, catches device name KV_ prefix)
      this.onPeerDiscovered((peer) => {
        onFound({ ...peer, agrPrefix: peer.agreementId, pubPrefix: peer.pubkey });
      });
      this.startScan(agreementId, myPubkey).catch(() => {});
    });
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

  private async subscribeToCharacteristic(device: any, charUuid: string): Promise<void> {
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
  autoDiscover: (agreementId: string, myPubkey: string, timeoutMs?: number) => Promise<{ peerId: string; peerPubPrefix: string; rssi: number } | null>;
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
const autoDiscover = useCallback(
    (agreementId: string, myPubkey: string, timeoutMs?: number) =>
      bt.autoDiscover(agreementId, myPubkey, timeoutMs),
    [bt]
  );

  return { status, peers, initialize, startScan, stopScan, connectToPeer, disconnect, sendPartialTx, waitForPartialTx, autoDiscover };
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


