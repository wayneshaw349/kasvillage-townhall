const fs = require('fs');
let c = fs.readFileSync('ProfileScreen.tsx', 'utf8');

// Add state for arweave attestation
const stateMarker = "const [existingSerialHash, setExistingSerialHash] = React.useState<string | null>(null);";
if (c.includes(stateMarker) && !c.includes('arweaveAttested')) {
  c = c.replace(stateMarker, stateMarker + "\n  const [arweaveAttested, setArweaveAttested] = React.useState(false);");
  console.log('1. Added arweaveAttested state');
}

// Check SecureStore on mount
const mountMarker = "getSerialHash().then(h => { if (h) { setExistingSerialHash(h); setSerialHashed(true); } });";
if (c.includes(mountMarker) && !c.includes('kv_arweave_attested')) {
  c = c.replace(mountMarker, mountMarker + "\n    SecureStore.getItemAsync('kv_arweave_attested').then(v => { if (v === 'true') setArweaveAttested(true); });");
  console.log('2. Added mount check');
}

// Add re-attest button (only shows if serial bound AND not yet attested to Arweave)
const oldBound = "                <Text style={{ color: '#666', fontSize: rs(10) }}>{existingSerialHash?.slice(0, 12)}...</Text>\n              </View>";
const newBound = "                <Text style={{ color: '#666', fontSize: rs(10) }}>{existingSerialHash?.slice(0, 12)}...</Text>\n              </View>\n" +
"              {!arweaveAttested && (\n" +
"              <TouchableOpacity\n" +
"                style={{ backgroundColor: '#2A4A6A', borderRadius: 8, padding: rs(10), marginTop: rs(8), alignItems: 'center' }}\n" +
"                onPress={async () => {\n" +
"                  try {\n" +
"                    const pubkey = await SecureStore.getItemAsync('kv_public_key') || '';\n" +
"                    const deviceHash = await getDeviceHash();\n" +
"                    const hash = existingSerialHash || '';\n" +
"                    await uploadToTurbo(JSON.stringify({ serialHash: hash, deviceHash, apt: aptNumber, timestamp: Date.now() }), [\n" +
"                      { name: 'KV-Type', value: 'device-attestation' },\n" +
"                      { name: 'KV-Pubkey', value: pubkey },\n" +
"                      { name: 'KV-Apt', value: aptNumber.replace('APT-','') },\n" +
"                      { name: 'KV-DeviceHash', value: deviceHash || '' },\n" +
"                      { name: 'KV-SerialHash', value: hash },\n" +
"                      { name: 'KV-Platform', value: Platform.OS },\n" +
"                    ]);\n" +
"                    await SecureStore.setItemAsync('kv_arweave_attested', 'true');\n" +
"                    setArweaveAttested(true);\n" +
"                    Alert.alert('\\u2705 Attested', 'Device attestation inscribed to Arweave.');\n" +
"                  } catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'Failed'); }\n" +
"                }}\n" +
"              >\n" +
"                <Text style={{ color: '#AAA', fontSize: rs(11) }}>Attest to Arweave</Text>\n" +
"              </TouchableOpacity>\n" +
"              )}";
if (c.includes(oldBound)) {
  c = c.replace(oldBound, newBound);
  console.log('3. Added one-time attest button');
} else { console.log('3. SKIP'); }

fs.writeFileSync('ProfileScreen.tsx', c);
console.log('Done');
