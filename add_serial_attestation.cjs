const fs = require("fs");
const path = require("path");

// ============================================================
// PATCH 1: device_attestation.ts — add serial hash functions
// ============================================================
const daFile = path.join(__dirname, "device_attestation.ts");
if (!fs.existsSync(daFile)) { console.log("⚠️  device_attestation.ts not found"); process.exit(1); }
let da = fs.readFileSync(daFile, "utf8");

// Find the last export or function in the file to append before it
const serialBlock = `

// ============================================================================
// SERIAL NUMBER HASH — Hardware-bound attestation (user pastes serial manually)
// ============================================================================
// Flow: User copies serial from Settings → About → pastes into app
// App hashes locally: SHA256(serial + anchor + applicationId)
// Only hash is stored/inscribed — raw serial NEVER leaves device
// ============================================================================

const STORE_KEY_SERIAL_HASH = 'kv_serial_hash';

/**
 * Hash a device serial number with the device anchor for hardware binding.
 * Result is deterministic: same serial + same device = same hash.
 */
export async function hashSerialNumber(serial: string): Promise<string> {
  const anchor = await getOrCreateAnchor();
  const appId = Application.applicationId || 'com.kasvillage.mobile';
  const input = \`KV_SERIAL:\${serial.trim().toUpperCase()}:\${anchor}:\${appId}\`;
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    input
  );
}

/**
 * Store the serial hash after user pastes their serial number.
 * Raw serial is NOT stored — only the one-way hash.
 */
export async function storeSerialHash(serial: string): Promise<string> {
  const hash = await hashSerialNumber(serial);
  await SecureStore.setItemAsync(STORE_KEY_SERIAL_HASH, hash);
  return hash;
}

/**
 * Get the stored serial hash (for Arweave inscription).
 * Returns null if user hasn't entered serial yet.
 */
export async function getSerialHash(): Promise<string | null> {
  return await SecureStore.getItemAsync(STORE_KEY_SERIAL_HASH);
}

/**
 * Verify a serial number matches the stored hash.
 * Used during device recovery / re-verification.
 */
export async function verifySerialNumber(serial: string): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(STORE_KEY_SERIAL_HASH);
  if (!stored) return false;
  const computed = await hashSerialNumber(serial);
  return computed === stored;
}
`;

// Append before the very last line or at end of file
if (da.includes("STORE_KEY_SERIAL_HASH")) {
  console.log("⚠️  device_attestation.ts — serial hash already present");
} else {
  // Append to end of file
  da += serialBlock;
  fs.writeFileSync(daFile, da, "utf8");
  console.log("✅ device_attestation.ts — serial hash functions added");
}

// ============================================================
// PATCH 2: Expo_identity_ritual.tsx — add serial paste UI +
//          wire device hash + serial hash into Arweave tags
// ============================================================
const ritualFile = path.join(__dirname, "Expo_identity_ritual.tsx");
if (!fs.existsSync(ritualFile)) { console.log("⚠️  Expo_identity_ritual.tsx not found"); process.exit(1); }
let ri = fs.readFileSync(ritualFile, "utf8");
let riFixes = 0;

// PATCH 2a: Add import for serial hash + device hash
const importAnchor = "import { getDeviceHash } from './device_attestation';";
const importReplacement = "import { getDeviceHash, storeSerialHash, getSerialHash } from './device_attestation';";

if (ri.includes(importAnchor) && !ri.includes("storeSerialHash")) {
  ri = ri.replace(importAnchor, importReplacement);
  riFixes++;
  console.log("  → import updated with storeSerialHash, getSerialHash");
} else if (!ri.includes("getDeviceHash") && !ri.includes("storeSerialHash")) {
  // No device_attestation import at all — add after last import block
  const lastImportIdx = ri.lastIndexOf("\nimport ");
  if (lastImportIdx > -1) {
    const lineEnd = ri.indexOf("\n", lastImportIdx + 1);
    ri = ri.slice(0, lineEnd + 1) + importReplacement + "\n" + ri.slice(lineEnd + 1);
    riFixes++;
    console.log("  → import added for device_attestation");
  }
}

// PATCH 2b: Add serial paste UI to PhaseAnchor — insert in funding step
// Find the "FUND YOUR WALLET" title and add serial paste section before mnemonic card
const serialUIAnchor = "{mnemonic && (";
const serialUI = `{/* Serial Number Attestation — hardware binding */}
        <View style={{ backgroundColor: '#1A2A3A', borderRadius: 16, padding: 16, marginTop: 16, borderWidth: 2, borderColor: '#4A90D9' }}>
          <Text style={{ color: '#4A90D9', fontSize: 14, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 }}>🔒 HARDWARE ATTESTATION</Text>
          <Text style={{ color: '#CCC', fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: 12 }}>
            Paste your device serial number to bind this wallet to your physical device.{\'\\n\'}
            Go to Settings → About → Serial Number → Copy
          </Text>
          <TextInput
            style={{ backgroundColor: '#0A0A0A', borderRadius: 10, padding: 14, color: '#FFF', fontSize: 16, fontWeight: 'bold', textAlign: 'center', borderWidth: 1, borderColor: '#4A90D9', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}
            placeholder="Paste serial number..."
            placeholderTextColor="#555"
            value={serialInput}
            onChangeText={setSerialInput}
            autoCapitalize="characters"
            returnKeyType="done"
            blurOnSubmit={true}
          />
          {serialInput.length >= 5 && (
            <TouchableOpacity
              style={{ backgroundColor: '#4A90D9', paddingVertical: 12, borderRadius: 10, marginTop: 10, alignItems: 'center' }}
              onPress={async () => {
                try {
                  const hash = await storeSerialHash(serialInput);
                  setSerialHashed(true);
                  Alert.alert('✅ Hardware Bound', 'Serial hash stored securely. Raw serial was NOT saved — only the one-way hash.');
                } catch (e) {
                  Alert.alert('Error', 'Failed to hash serial');
                }
              }}
            >
              <Text style={{ color: '#FFF', fontSize: 14, fontWeight: 'bold' }}>
                {serialHashed ? '✓ Serial Hashed' : '🔐 Hash & Store'}
              </Text>
            </TouchableOpacity>
          )}
          {serialHashed && (
            <Text style={{ color: '#4CAF50', fontSize: 11, textAlign: 'center', marginTop: 8 }}>
              ✓ Device hardware-bound. This hash will be inscribed to Arweave.
            </Text>
          )}
        </View>

        `;

if (ri.includes(serialUIAnchor) && !ri.includes("HARDWARE ATTESTATION")) {
  ri = ri.replace(serialUIAnchor, serialUI + serialUIAnchor);
  riFixes++;
  console.log("  → Serial paste UI added to PhaseAnchor funding step");
}

// PATCH 2c: Add state variables for serial input
const stateAnchor = "const [showMnemonic, setShowMnemonic] = useState(false);";
const stateAddition = "const [showMnemonic, setShowMnemonic] = useState(false);\n  const [serialInput, setSerialInput] = useState('');\n  const [serialHashed, setSerialHashed] = useState(false);";

if (ri.includes(stateAnchor) && !ri.includes("serialInput")) {
  ri = ri.replace(stateAnchor, stateAddition);
  riFixes++;
  console.log("  → Serial state variables added to PhaseAnchor");
}

// PATCH 2d: Wire device hash + serial hash into Arweave tags
const arTagsAnchor = '{ name: "Unix-Time", value: String(Math.floor(Date.now() / 1000)) },\n        ];';
const arTagsReplacement = `{ name: "Unix-Time", value: String(Math.floor(Date.now() / 1000)) },
        ];
        // Add device attestation tags (non-blocking)
        try {
          const deviceHash = await getDeviceHash();
          if (deviceHash) arTags.push({ name: "KV-DeviceHash", value: deviceHash });
          const serialHash = await getSerialHash();
          if (serialHash) arTags.push({ name: "KV-SerialHash", value: serialHash });
        } catch (attErr) {
          console.warn("[PhaseAnchor] Attestation tags failed (non-fatal):", attErr);
        }`;

if (ri.includes('{ name: "Unix-Time"') && !ri.includes("KV-DeviceHash")) {
  ri = ri.replace(arTagsAnchor, arTagsReplacement);
  riFixes++;
  console.log("  → Device hash + serial hash wired into Arweave tags");
}

if (riFixes > 0) {
  fs.writeFileSync(ritualFile, ri, "utf8");
  console.log(`✅ Expo_identity_ritual.tsx — ${riFixes} patches applied`);
} else {
  console.log("⚠️  Expo_identity_ritual.tsx — no anchors found or already patched");
}

console.log("\n📋 Summary:");
console.log("  device_attestation.ts: hashSerialNumber(), storeSerialHash(), getSerialHash(), verifySerialNumber()");
console.log("  PhaseAnchor: serial paste UI in funding step + Arweave tags KV-DeviceHash + KV-SerialHash");
console.log("  Recovery: if device changes, user re-enters serial or uses 12-word mnemonic");
console.log("  Privacy: raw serial NEVER stored or transmitted — only SHA256 hash");
