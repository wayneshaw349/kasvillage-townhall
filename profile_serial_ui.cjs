const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "ProfileScreen.tsx");
if (!fs.existsSync(file)) { console.log("⚠️  ProfileScreen.tsx not found"); process.exit(1); }
let s = fs.readFileSync(file, "utf8");

// Find the closing </View> of the securityCard — after seedExportButton
const anchor = `<Text style={styles.seedExportArrow}>›</Text>
          </TouchableOpacity>
        </View>`;

const replacement = `<Text style={styles.seedExportArrow}>›</Text>
          </TouchableOpacity>

          {/* Hardware Attestation — Serial Bind */}
          <View style={{ marginTop: rs(12), backgroundColor: '#1A2A3A', borderRadius: 12, padding: rs(14), borderWidth: 1, borderColor: '#4A90D9' }}>
            <Text style={{ color: '#4A90D9', fontSize: rs(14), fontWeight: 'bold', marginBottom: rs(4) }}>🔒 Hardware Bind</Text>
            <Text style={{ color: '#AAA', fontSize: rs(11), lineHeight: rs(16), marginBottom: rs(8) }}>
              Bind this wallet to your physical device. Your serial is NEVER stored or transmitted — only a one-way hash is kept locally on your device.
            </Text>
            {serialHashed ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: '#4CAF50', fontSize: rs(13), fontWeight: '600' }}>✓ Device hardware-bound</Text>
                <Text style={{ color: '#666', fontSize: rs(10) }}>{existingSerialHash?.slice(0, 12)}...</Text>
              </View>
            ) : (
              <>
                <Text style={{ color: '#888', fontSize: rs(10), marginBottom: rs(6) }}>Settings → About → Serial Number → Copy → Paste below</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    style={{ flex: 1, backgroundColor: '#0A0A14', borderRadius: 8, padding: rs(10), color: '#FFF', fontSize: rs(14), fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', borderWidth: 1, borderColor: '#333' }}
                    placeholder="Paste serial..."
                    placeholderTextColor="#555"
                    value={serialInput}
                    onChangeText={setSerialInput}
                    autoCapitalize="characters"
                  />
                  {serialInput.length >= 5 && (
                    <TouchableOpacity
                      style={{ backgroundColor: '#4A90D9', borderRadius: 8, paddingHorizontal: rs(14), justifyContent: 'center' }}
                      onPress={async () => {
                        try {
                          const hash = await storeSerialHash(serialInput);
                          setSerialHashed(true);
                          setExistingSerialHash(hash);
                          Alert.alert('✅ Hardware Bound', 'Serial hash stored. Raw serial was NOT saved.');
                        } catch (e: any) { Alert.alert('Error', e.message); }
                      }}
                    >
                      <Text style={{ color: '#FFF', fontSize: rs(13), fontWeight: 'bold' }}>Bind</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </View>
        </View>`;

if (s.includes(anchor)) {
  s = s.replace(anchor, replacement);
  fs.writeFileSync(file, s, "utf8");
  console.log("✅ ProfileScreen.tsx — serial bind UI added to Security section");
} else {
  console.log("⚠️  Anchor not found — check if seedExportArrow text matches");
  // Try looser match
  if (s.includes("seedExportArrow")) {
    console.log("   seedExportArrow exists but surrounding text differs. May need manual placement.");
  }
}

// Add Platform import if missing
if (!s.includes("Platform") || (!s.includes("import { Platform") && !s.includes("Platform,"))) {
  // Check if Platform is already imported via react-native
  if (s.includes("from 'react-native'") && !s.includes("Platform")) {
    const rnImport = s.match(/import\s*\{([^}]+)\}\s*from\s*'react-native'/);
    if (rnImport) {
      const newImport = rnImport[0].replace("} from 'react-native'", ", Platform } from 'react-native'");
      s = s.replace(rnImport[0], newImport);
      fs.writeFileSync(file, s, "utf8");
      console.log("  → Platform import added to react-native imports");
    }
  }
}

// Add TextInput import if missing
if (s.includes("from 'react-native'") && !s.includes("TextInput")) {
  const rnImport = s.match(/import\s*\{([^}]+)\}\s*from\s*'react-native'/);
  if (rnImport) {
    const newImport = rnImport[0].replace("} from 'react-native'", ", TextInput } from 'react-native'");
    s = fs.readFileSync(file, "utf8"); // re-read after Platform addition
    if (!s.includes("TextInput")) {
      const rnImport2 = s.match(/import\s*\{([^}]+)\}\s*from\s*'react-native'/);
      if (rnImport2) {
        s = s.replace(rnImport2[0], rnImport2[0].replace("} from 'react-native'", ", TextInput } from 'react-native'"));
        fs.writeFileSync(file, s, "utf8");
        console.log("  → TextInput import added");
      }
    }
  }
}
