const fs = require("fs");
let s = fs.readFileSync("QRPayNearby.tsx", "utf8");

// Add BLE import
s = s.replace(
  "import QRCode from 'react-native-qrcode-svg';",
  "import QRCode from 'react-native-qrcode-svg';\nimport { useBluetoothPay } from './bluetooth_p2p';"
);

// Add 'ble_send' | 'ble_receive' to Mode type
s = s.replace(
  "type Mode = 'choose' | 'receive' | 'send';",
  "type Mode = 'choose' | 'receive' | 'send' | 'ble_send' | 'ble_receive';"
);

// Add BLE hook + state inside the component, after the pasteInput state
s = s.replace(
  "const [resolvedAddress, setResolvedAddress] = useState('');",
  `const [resolvedAddress, setResolvedAddress] = useState('');
  const { scanning, advertising, payees, startReceiving, stopReceiving, startScanning, stopScanning } = useBluetoothPay();
  const [selectedPeer, setSelectedPeer] = useState<any>(null);`
);

// Add BLE buttons to choose screen, before the hotspot card
s = s.replace(
  "{/* Hotspot Info */}",
  `{/* Bluetooth Option */}
            <View style={{ marginTop: rs(8), borderTopWidth: 1, borderTopColor: '#222', paddingTop: rs(12) }}>
              <Text style={{ color: '#666', fontSize: rs(11), textAlign: 'center', marginBottom: rs(8) }}>Or use Bluetooth (same platform only)</Text>
              <View style={{ flexDirection: 'row', gap: rs(8) }}>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: '#1A1A2E', borderRadius: rs(12), padding: rs(14), alignItems: 'center', borderWidth: 1, borderColor: '#4169E1' }}
                  onPress={() => { setMode('ble_receive'); startReceiving(address, avatarName); }}
                >
                  <Text style={{ color: '#4169E1', fontSize: rs(13), fontWeight: '600' }}>📶 BLE Receive</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: '#1A1A2E', borderRadius: rs(12), padding: rs(14), alignItems: 'center', borderWidth: 1, borderColor: '#4CAF50' }}
                  onPress={() => { setMode('ble_send'); startScanning(20000); }}
                >
                  <Text style={{ color: '#4CAF50', fontSize: rs(13), fontWeight: '600' }}>📶 BLE Send</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Hotspot Info */}`
);

// Add BLE render blocks before the footer spacing
s = s.replace(
  "<View style={{ height: rs(40) }} />",
  `{/* BLE RECEIVE */}
        {mode === 'ble_receive' && (
          <View style={{ alignItems: 'center' }}>
            <TouchableOpacity onPress={() => { stopReceiving(); setMode('choose'); }} style={{ alignSelf: 'flex-start', marginBottom: rs(12) }}>
              <Text style={{ color: '#F59E0B', fontSize: rs(14) }}>← Back to QR</Text>
            </TouchableOpacity>
            <View style={{ backgroundColor: '#1A1A2E', borderWidth: 2, borderColor: '#4169E1', borderRadius: rs(16), padding: rs(24), alignItems: 'center', width: '100%' }}>
              {advertising && <Text style={{ color: '#4169E1', fontSize: rs(40), marginBottom: rs(12) }}>📡</Text>}
              <Text style={{ color: '#4169E1', fontSize: rs(18), fontWeight: '700' }}>
                {advertising ? 'Broadcasting...' : 'Starting BLE...'}
              </Text>
              <Text style={{ color: '#87CEEB', fontSize: rs(12), marginTop: rs(8), textAlign: 'center' }}>
                Your address is visible to nearby senders via Bluetooth
              </Text>
              <Text style={{ color: '#666', fontSize: rs(10), marginTop: rs(12), textAlign: 'center' }}>{address}</Text>
            </View>
            <TouchableOpacity
              style={{ marginTop: rs(16), backgroundColor: '#333', borderRadius: rs(10), paddingVertical: rs(12), paddingHorizontal: rs(24) }}
              onPress={() => { stopReceiving(); setMode('choose'); }}
            >
              <Text style={{ color: '#FFF', fontSize: rs(14) }}>Stop Receiving</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* BLE SEND */}
        {mode === 'ble_send' && (
          <View>
            <TouchableOpacity onPress={() => { stopScanning(); setMode('choose'); }} style={{ marginBottom: rs(12) }}>
              <Text style={{ color: '#F59E0B', fontSize: rs(14) }}>← Back to QR</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: rs(12) }}>
              <Text style={{ color: '#4CAF50', fontSize: rs(16), fontWeight: '700' }}>
                {scanning ? 'Scanning... ' : 'Scan complete '}
              </Text>
              <Text style={{ color: '#4CAF50', fontSize: rs(14) }}>Found {payees.length} nearby</Text>
              <TouchableOpacity onPress={() => { stopScanning(); setMode('choose'); }} style={{ marginLeft: 'auto' }}>
                <Text style={{ color: '#FF6B6B', fontSize: rs(14) }}>Cancel</Text>
              </TouchableOpacity>
            </View>
            {payees.length === 0 && scanning && (
              <Text style={{ color: '#666', textAlign: 'center', marginTop: rs(30), fontSize: rs(13) }}>
                Looking for nearby KasVillage users...
              </Text>
            )}
            {payees.map((p: any) => (
              <TouchableOpacity
                key={p.id}
                style={{ backgroundColor: '#1A1A1A', borderRadius: rs(12), padding: rs(14), marginBottom: rs(8), borderWidth: 1, borderColor: '#333' }}
                onPress={() => {
                  setResolvedAddress(p.kaspaAddress);
                  stopScanning();
                  setMode('send');
                  setPasteInput(p.kaspaAddress);
                }}
              >
                <Text style={{ color: '#FFF', fontSize: rs(15), fontWeight: '600' }}>{p.displayName}</Text>
                <Text style={{ color: '#888', fontSize: rs(11), marginTop: rs(2) }}>{p.kaspaAddress.slice(0, 30)}...</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: rs(40) }} />`
);

fs.writeFileSync("QRPayNearby.tsx", s, "utf8");
console.log("done: BLE modes added to QRPayNearby");
