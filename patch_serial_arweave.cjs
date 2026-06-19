const fs = require('fs');
let c = fs.readFileSync('ProfileScreen.tsx', 'utf8');

// Add import for Arweave upload
const oldImport = "import { storeSerialHash, getSerialHash } from './device_attestation';";
const newImport = "import { storeSerialHash, getSerialHash, getDeviceHash } from './device_attestation';\nimport { uploadToArweave } from './arweave_upload';";
if (c.includes(oldImport)) {
  c = c.replace(oldImport, newImport);
  console.log('1. Added imports');
} else { console.log('1. SKIP'); }

// After storeSerialHash, inscribe to Arweave
const oldBind = "const hash = await storeSerialHash(serialInput);\n                          setSerialHashed(true);\n                          setExistingSerialHash(hash);\n                          Alert.alert('\\u2705 Hardware Bound', 'Serial hash stored. Raw serial was NOT saved.');";
const newBind = "const hash = await storeSerialHash(serialInput);\n                          setSerialHashed(true);\n                          setExistingSerialHash(hash);\n                          // Inscribe serial hash to Arweave (permanent)\n                          try {\n                            const pubkey = await SecureStore.getItemAsync('kv_public_key') || '';\n                            const deviceHash = await getDeviceHash();\n                            const apt = aptNumber;\n                            await uploadToArweave(JSON.stringify({ serialHash: hash, deviceHash, apt, timestamp: Date.now() }), [\n                              { name: 'KV-Type', value: 'device-attestation' },\n                              { name: 'KV-Pubkey', value: pubkey },\n                              { name: 'KV-Apt', value: apt.replace('APT-','') },\n                              { name: 'KV-DeviceHash', value: deviceHash || '' },\n                              { name: 'KV-SerialHash', value: hash },\n                              { name: 'KV-Platform', value: Platform.OS },\n                            ]);\n                            console.log('[Serial] Inscribed to Arweave');\n                          } catch (e) { console.warn('[Serial] Arweave inscription failed (non-fatal):', e); }\n                          Alert.alert('\\u2705 Hardware Bound', 'Serial hash stored and inscribed to Arweave. Raw serial was NOT saved.');";
if (c.includes(oldBind)) {
  c = c.replace(oldBind, newBind);
  console.log('2. Added Arweave inscription on serial bind');
} else { console.log('2. SKIP - bind block not found'); }

fs.writeFileSync('ProfileScreen.tsx', c);
console.log('Done');
