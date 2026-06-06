// patch_ble_dual_mode.cjs
// Replaces react-native-peripheral approach with react-native-ble-advertiser
// Architecture:
//   BLE = proximity discovery (both phones advertise + scan simultaneously)
//   Arweave = data exchange (partial sigs too large for BLE advertisements)
//   BLE proves physical proximity → anti-remote-attack
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'bluetooth_p2p.ts');
let src = fs.readFileSync(file, 'utf8');

// 1. Remove react-native-peripheral import if present (from old patch)
src = src.replace(/import Peripheral.*from 'react-native-peripheral';\n?/g, '');

// 2. Add ble-advertiser import
if (!src.includes('react-native-ble-advertiser')) {
  src = src.replace(
    "import { BleManager, Device, State } from 'react-native-ble-plx';",
    `import { BleManager, Device, State } from 'react-native-ble-plx';
import BLEAdvertiser from 'react-native-ble-advertiser';`
  );
}

// 3. Add company ID constant
src = src.replace(
  "const KV_SERVICE_UUID = '6b617376-696c-6c61-6765-000000000001';",
  `const KV_COMPANY_ID = 0x4B56; // "KV" in hex
const KV_SERVICE_UUID = '6b617376-696c-6c61-6765-000000000001';`
);

// 4. Replace stub startAdvertising with real BLE advertising
const advertisingBlock = `
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
  }`;

// Remove the old stub startAdvertising + stopAdvertising
src = src.replace(
  /  async startAdvertising\(agreementId: string, myPubkey: string\): Promise<boolean> \{[\s\S]*?  stopAdvertising\(\): void \{[\s\S]*?\n  \}/,
  advertisingBlock
);

// 5. Update destroy to clean up advertiser
src = src.replace(
  `  destroy(): void {
    this.stopScan();
    this.disconnect();
    this.manager.destroy();
  }`,
  `  destroy(): void {
    this.stopScan();
    this.stopAdvertising();
    this.stopAdvertiserScan();
    this.disconnect();
    this.manager.destroy();
  }`
);

// Also handle if peripheral patch was previously applied
src = src.replace(
  `  destroy(): void {
    this.stopScan();
    this.stopPeripheral();
    this.disconnect();
    this.manager.destroy();
  }`,
  `  destroy(): void {
    this.stopScan();
    this.stopAdvertising();
    this.stopAdvertiserScan();
    this.disconnect();
    this.manager.destroy();
  }`
);

// 6. Add autoDiscover + stopAdvertiserScan to the React hook
const hookAddition = `
  const autoDiscover = useCallback(
    (agreementId: string, myPubkey: string, timeoutMs?: number) =>
      bt.autoDiscover(agreementId, myPubkey, timeoutMs),
    [bt]
  );`;

// Find the hook return and add autoDiscover
if (src.includes('autoConnect, updatePartialTx, stopPeripheral')) {
  // Previous peripheral patch was applied — replace
  src = src.replace(
    /  const autoConnect = useCallback[\s\S]*?stopPeripheral \};/,
    hookAddition.trim() + `

  return { status, peers, initialize, startScan, stopScan, connectToPeer, disconnect, sendPartialTx, waitForPartialTx, autoDiscover };`
  );
} else {
  // Clean state — add before return
  src = src.replace(
    `  return { status, peers, initialize, startScan, stopScan, connectToPeer, disconnect, sendPartialTx, waitForPartialTx };`,
    hookAddition + `

  return { status, peers, initialize, startScan, stopScan, connectToPeer, disconnect, sendPartialTx, waitForPartialTx, autoDiscover };`
  );
}

// 7. Remove any leftover react-native-peripheral code blocks
src = src.replace(/  \/\/ =+\n  \/\/ PERIPHERAL MODE.*?isPeripheralRunning\(\): boolean \{[\s\S]*?return this\.peripheralRunning;\n  \}\n/g, '');
src = src.replace(/  \/\/ =+\n  \/\/ AUTO-NEGOTIATE:.*?}\n  \}/g, '');

// 8. Add iOS background mode note
src = src.replace(
  "const KV_COMPANY_ID = 0x4B56; // \"KV\" in hex",
  `const KV_COMPANY_ID = 0x4B56; // "KV" in hex
// NOTE: For iOS background BLE, add to app.json infoPlist:
//   "UIBackgroundModes": ["bluetooth-central", "bluetooth-peripheral"]`
);

fs.writeFileSync(file, src, 'utf8');
console.log('✅ bluetooth_p2p.ts patched (ble-advertiser):');
console.log('   - startAdvertising(agrId, pubkey) — broadcast service UUID + mfg data');
console.log('   - startAdvertiserScan(agrId, cb) — scan for KV peers');
console.log('   - autoDiscover(agrId, pubkey) — dual-mode: advertise + scan simultaneously');
console.log('   - BLE = proximity proof, Arweave = data exchange');
console.log('   - Cross-platform: iOS ↔ Android');
console.log('');
console.log('Install: npm install react-native-ble-advertiser react-native-ble-plx');
console.log('         npx expo install expo-device expo-application');
console.log('Remove:  npm uninstall react-native-peripheral');
console.log('Then:    eas build --profile development --platform all');
