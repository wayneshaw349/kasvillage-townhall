const fs = require('fs');
let c = fs.readFileSync('ProfileScreen.tsx', 'utf8');

// 1. Replace the mount reset with auto-attest logic
const oldMount = "// One-time reset: re-attest with correct APT derivation\n    SecureStore.deleteItemAsync('kv_arweave_attested').catch(() => {});\n    setArweaveAttested(false);";
const newMount = "SecureStore.getItemAsync('kv_arweave_attested').then(async (v) => {\n      if (v === 'true') { setArweaveAttested(true); return; }\n      // Auto-inscribe if serial bound but not yet attested\n      const sh = await getSerialHash();\n      if (sh) {\n        try {\n          const pubkey = await SecureStore.getItemAsync('kv_public_key') || '';\n          const deviceHash = await getDeviceHash();\n          const { deriveApt: da } = await import('./apt_derivation');\n          const apt = da(pubkey);\n          await uploadToTurbo(JSON.stringify({ serialHash: sh, deviceHash, apt: 'APT-' + apt, timestamp: Date.now() }), [\n            { name: 'KV-Type', value: 'device-attestation' },\n            { name: 'KV-Pubkey', value: pubkey },\n            { name: 'KV-Apt', value: apt },\n            { name: 'KV-DeviceHash', value: deviceHash || '' },\n            { name: 'KV-SerialHash', value: sh },\n            { name: 'KV-Platform', value: Platform.OS },\n          ]);\n          await SecureStore.setItemAsync('kv_arweave_attested', 'true');\n          setArweaveAttested(true);\n          console.log('[Serial] Auto-attested to Arweave');\n        } catch (e) { console.warn('[Serial] Auto-attest failed (non-fatal):', e); }\n      }\n    });";
if (c.includes(oldMount)) {
  c = c.replace(oldMount, newMount);
  console.log('1. Replaced with auto-attest on mount');
} else { console.log('1. SKIP'); }

// 2. Remove the attest button entirely
const buttonStart = "              {!arweaveAttested && (\n              <TouchableOpacity";
const buttonEnd = "              )}";
const idx = c.indexOf(buttonStart);
if (idx > -1) {
  const endIdx = c.indexOf(buttonEnd, idx);
  if (endIdx > -1) {
    c = c.substring(0, idx) + c.substring(endIdx + buttonEnd.length);
    console.log('2. Removed attest button');
  }
} else { console.log('2. SKIP'); }

fs.writeFileSync('ProfileScreen.tsx', c);
console.log('Done');
