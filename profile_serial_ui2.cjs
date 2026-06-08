const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "ProfileScreen.tsx");
if (!fs.existsSync(file)) { console.log("⚠️  ProfileScreen.tsx not found"); process.exit(1); }
let s = fs.readFileSync(file, "utf8");

const anchor = `<Text style={styles.seedExportArrow}>\u203a</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}`;

const replacement = `<Text style={styles.seedExportArrow}>\u203a</Text>
          </TouchableOpacity>

          {/* Hardware Attestation — Serial Bind */}
          <View style={{ marginTop: rs(12), backgroundColor: '#1A2A3A', borderRadius: rs(12), padding: rs(14), borderWidth: 1, borderColor: '#4A90D9' }}>
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
        </View>

        {/* Quick Actions */}`;

if (s.includes(anchor)) {
  s = s.replace(anchor, replacement);
  fs.writeFileSync(file, s, "utf8");
  console.log("✅ ProfileScreen.tsx — serial bind UI added to Security section");
} else {
  console.log("⚠️  Exact anchor not found. Trying flexible match...");
  
  // Try matching just the closing pattern
  const flexAnchor = "seedExportArrow}>›</Text>\n          </TouchableOpacity>\n        </View>\n\n        {/* Quick Actions */}";
  if (s.includes(flexAnchor)) {
    s = s.replace(flexAnchor, replacement.replace(anchor.split('\n')[0], flexAnchor.split('\n')[0]));
    fs.writeFileSync(file, s, "utf8");
    console.log("✅ ProfileScreen.tsx — serial bind UI added (flex match)");
  } else {
    // Last resort: find seedExportArrow and inject after its parent TouchableOpacity
    const idx = s.indexOf("seedExportArrow");
    if (idx > -1) {
      // Find the </TouchableOpacity> after seedExportArrow
      const afterArrow = s.indexOf("</TouchableOpacity>", idx);
      if (afterArrow > -1) {
        const insertPoint = afterArrow + "</TouchableOpacity>".length;
        const serialUI = `

          {/* Hardware Attestation — Serial Bind */}
          <View style={{ marginTop: rs(12), backgroundColor: '#1A2A3A', borderRadius: rs(12), padding: rs(14), borderWidth: 1, borderColor: '#4A90D9' }}>
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
                          Alert.alert('\\u2705 Hardware Bound', 'Serial hash stored. Raw serial was NOT saved.');
                        } catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'Failed'); }
                      }}
                    >
                      <Text style={{ color: '#FFF', fontSize: rs(13), fontWeight: 'bold' }}>Bind</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </View>`;
        s = s.slice(0, insertPoint) + serialUI + s.slice(insertPoint);
        fs.writeFileSync(file, s, "utf8");
        console.log("✅ ProfileScreen.tsx — serial bind UI added (fallback insert after seedExportArrow)");
      } else {
        console.log("❌ Could not find insertion point");
      }
    } else {
      console.log("❌ seedExportArrow not found in file");
    }
  }
}
