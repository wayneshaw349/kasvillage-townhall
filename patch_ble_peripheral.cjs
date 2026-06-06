// patch_ble_peripheral.cjs
// Adds real BLE peripheral mode to bluetooth_p2p.ts
// Uses react-native-peripheral for GATT server (iOS + Android)
// Flow: seller=peripheral, buyer=central, auto-negotiate
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'bluetooth_p2p.ts');
let src = fs.readFileSync(file, 'utf8');

// 1. Add import for react-native-peripheral
src = src.replace(
  "import { BleManager, Device, State } from 'react-native-ble-plx';",
  `import { BleManager, Device, State } from 'react-native-ble-plx';
import Peripheral, { Service, Characteristic } from 'react-native-peripheral';`
);

// 2. Replace stub startAdvertising with real peripheral
const peripheralBlock = `
  // ===========================================================================
  // PERIPHERAL MODE (GATT Server) — cross-platform iOS + Android
  // ===========================================================================

  private peripheralRunning = false;
  private onCentralWriteCallback?: (data: string, centralId: string) => void;

  /**
   * Start as BLE peripheral: advertise service + host GATT characteristics.
   * The other phone (central) connects, reads pubkey, writes partial TX.
   */
  async startPeripheral(agreementId: string, myPubkey: string, myPartialTx?: string): Promise<boolean> {
    if (this.peripheralRunning) return true;
    this.myAgreementId = agreementId;
    this.myPubkey = myPubkey;

    try {
      // Define GATT service with characteristics
      const service: Service = {
        uuid: KV_SERVICE_UUID,
        characteristics: [
          {
            uuid: KV_CHAR_AGREEMENT_ID,
            value: strToBase64(agreementId),
            properties: ['read'],
            permissions: ['readable'],
          },
          {
            uuid: KV_CHAR_PUBKEY,
            value: strToBase64(myPubkey),
            properties: ['read'],
            permissions: ['readable'],
          },
          {
            uuid: KV_CHAR_PARTIAL_TX,
            value: myPartialTx ? strToBase64(myPartialTx) : strToBase64(''),
            properties: ['read', 'write', 'notify'],
            permissions: ['readable', 'writeable'],
          },
          {
            uuid: KV_CHAR_STATUS,
            value: strToBase64('waiting'),
            properties: ['read', 'write', 'notify'],
            permissions: ['readable', 'writeable'],
          },
        ],
      };

      // Add service to GATT server
      await Peripheral.addService(service);

      // Listen for writes from central (buyer sends partial TX)
      Peripheral.onWriteRequest((request: { characteristicUUID: string; value: string; centralUUID: string }) => {
        if (request.characteristicUUID.toLowerCase() === KV_CHAR_PARTIAL_TX.toLowerCase()) {
          try {
            const decoded = base64ToStr(request.value);
            console.log('[BLE-Periph] Received partial TX from central:', decoded.slice(0, 40));
            this.onCentralWriteCallback?.(decoded, request.centralUUID);
            this.dataCallback?.(decoded, request.centralUUID);
          } catch (e) {
            console.error('[BLE-Periph] Write decode error:', e);
          }
        }
        if (request.characteristicUUID.toLowerCase() === KV_CHAR_STATUS.toLowerCase()) {
          try {
            const status = base64ToStr(request.value);
            console.log('[BLE-Periph] Status update from central:', status);
          } catch {}
        }
      });

      // Start advertising with device name prefix for discovery
      const advName = 'KV_' + agreementId.slice(0, 8);
      await Peripheral.startAdvertising({
        name: advName,
        serviceUuids: [KV_SERVICE_UUID],
      });

      this.peripheralRunning = true;
      console.log('[BLE-Periph] Advertising as:', advName);
      this.updateStatus({ available: true, enabled: true });
      return true;
    } catch (e) {
      console.error('[BLE-Periph] Start failed:', e);
      this.updateStatus({ error: 'Peripheral start failed: ' + String(e) });
      return false;
    }
  }

  /**
   * Update the partial TX characteristic value (after signing).
   * Central can read or gets notified.
   */
  async updatePartialTx(partialTx: string): Promise<void> {
    try {
      await Peripheral.updateCharacteristicValue(
        KV_SERVICE_UUID,
        KV_CHAR_PARTIAL_TX,
        strToBase64(partialTx)
      );
      console.log('[BLE-Periph] Updated partial TX characteristic');
    } catch (e) {
      console.error('[BLE-Periph] Update char failed:', e);
    }
  }

  /**
   * Update status characteristic (e.g. 'signed', 'complete', 'deadlock').
   */
  async updatePeripheralStatus(status: string): Promise<void> {
    try {
      await Peripheral.updateCharacteristicValue(
        KV_SERVICE_UUID,
        KV_CHAR_STATUS,
        strToBase64(status)
      );
    } catch {}
  }

  /**
   * Register callback for when central writes partial TX.
   */
  onCentralWrite(callback: (data: string, centralId: string) => void): void {
    this.onCentralWriteCallback = callback;
  }

  /**
   * Stop peripheral mode.
   */
  async stopPeripheral(): Promise<void> {
    if (!this.peripheralRunning) return;
    try {
      await Peripheral.stopAdvertising();
      await Peripheral.removeService(KV_SERVICE_UUID);
    } catch {}
    this.peripheralRunning = false;
    console.log('[BLE-Periph] Stopped');
  }

  isPeripheralRunning(): boolean {
    return this.peripheralRunning;
  }

  // ===========================================================================
  // AUTO-NEGOTIATE: Both phones try peripheral + central simultaneously.
  // First successful connection wins. Prevents "who goes first" problem.
  // ===========================================================================

  async autoConnect(
    agreementId: string,
    myPubkey: string,
    myPartialTx?: string,
    timeoutMs = 30000,
  ): Promise<{ role: 'central' | 'peripheral'; peerId: string } | null> {
    console.log('[BLE-Auto] Starting dual-mode for agreement:', agreementId.slice(0, 12));

    // Start both simultaneously
    const peripheralReady = this.startPeripheral(agreementId, myPubkey, myPartialTx);

    return new Promise(async (resolve) => {
      let resolved = false;
      const cleanup = () => {
        if (resolved) return;
        resolved = true;
        this.stopScan();
        // Don't stop peripheral if we're the peripheral
      };

      const timeout = setTimeout(() => {
        cleanup();
        this.stopPeripheral();
        resolve(null);
      }, timeoutMs);

      // Central path: scan for the other phone's peripheral
      this.onPeerDiscovered(async (peer) => {
        if (resolved) return;
        if (peer.agreementId && agreementId.startsWith(peer.agreementId)) {
          console.log('[BLE-Auto] Found peer via scan:', peer.id);
          const connected = await this.connectToPeer(peer.id);
          if (connected && !resolved) {
            clearTimeout(timeout);
            cleanup();
            await this.stopPeripheral(); // We're the central, stop our peripheral
            resolve({ role: 'central', peerId: peer.id });
          }
        }
      });

      // Peripheral path: detect when central connects to us
      this.onCentralWrite((data, centralId) => {
        if (resolved) return;
        console.log('[BLE-Auto] Central connected and wrote data:', centralId);
        clearTimeout(timeout);
        resolved = true;
        this.stopScan(); // We're the peripheral, stop scanning
        resolve({ role: 'peripheral', peerId: centralId });
      });

      await peripheralReady;
      await this.startScan(agreementId, myPubkey);
    });
  }`;

// Insert after the existing stopAdvertising method
src = src.replace(
  `  stopAdvertising(): void {
    this.isAdvertising = false;
  }`,
  `  stopAdvertising(): void {
    this.isAdvertising = false;
    this.stopPeripheral();
  }
${peripheralBlock}`
);

// 3. Update destroy to clean up peripheral
src = src.replace(
  `  destroy(): void {
    this.stopScan();
    this.disconnect();
    this.manager.destroy();
  }`,
  `  destroy(): void {
    this.stopScan();
    this.stopPeripheral();
    this.disconnect();
    this.manager.destroy();
  }`
);

// 4. Add autoConnect to the React hook
src = src.replace(
  `  const waitForPartialTx = useCallback((timeoutMs?: number) => bt.waitForPartialTx(timeoutMs), [bt]);

  return { status, peers, initialize, startScan, stopScan, connectToPeer, disconnect, sendPartialTx, waitForPartialTx };`,
  `  const waitForPartialTx = useCallback((timeoutMs?: number) => bt.waitForPartialTx(timeoutMs), [bt]);
  const autoConnect = useCallback(
    (agreementId: string, myPubkey: string, myPartialTx?: string, timeoutMs?: number) =>
      bt.autoConnect(agreementId, myPubkey, myPartialTx, timeoutMs),
    [bt]
  );
  const updatePartialTx = useCallback((tx: string) => bt.updatePartialTx(tx), [bt]);
  const stopPeripheral = useCallback(() => bt.stopPeripheral(), [bt]);

  return { status, peers, initialize, startScan, stopScan, connectToPeer, disconnect, sendPartialTx, waitForPartialTx, autoConnect, updatePartialTx, stopPeripheral };`
);

fs.writeFileSync(file, src, 'utf8');
console.log('✅ bluetooth_p2p.ts patched with peripheral mode:');
console.log('   - startPeripheral(agrId, pubkey, partialTx) — GATT server');
console.log('   - autoConnect(agrId, pubkey, partialTx) — dual-mode race');
console.log('   - updatePartialTx(tx) — notify central of new data');
console.log('   - onCentralWrite(cb) — receive data from central');
console.log('   - Cross-platform: iOS ↔ Android in both directions');
console.log('');
console.log('Install: npm install react-native-peripheral');
console.log('Then: eas build --profile development --platform all');
