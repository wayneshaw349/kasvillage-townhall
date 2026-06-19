const fs = require('fs');
let c = fs.readFileSync('ProfileScreen.tsx', 'utf8');

// 1. Add import
const oldImport = "import { storeSerialHash, getSerialHash, getDeviceHash } from './device_attestation';";
if (c.includes(oldImport) && !c.includes('apt_derivation')) {
  c = c.replace(oldImport, oldImport + "\nimport { deriveApt } from './apt_derivation';");
  console.log('1. Added deriveApt import');
} else { console.log('1. SKIP'); }

// 2. Replace inline APT derivation
const oldDerive = "const hexSlice = pubkey.slice(2, 9);";
if (c.includes(oldDerive)) {
  const start = c.indexOf(oldDerive);
  const end = c.indexOf("setAptNumber(apt);", start) + "setAptNumber(apt);".length;
  c = c.substring(0, start) + "const apt = 'APT-' + deriveApt(pubkey);\n          setAptNumber(apt);" + c.substring(end);
  console.log('2. Replaced inline derivation with canonical deriveApt');
} else { console.log('2. SKIP'); }

// 3. Reset kv_arweave_attested so button reappears for correct attestation
const mountCheck = "SecureStore.getItemAsync('kv_arweave_attested').then(v => { if (v === 'true') setArweaveAttested(true); });";
if (c.includes(mountCheck)) {
  c = c.replace(mountCheck, 
    "// One-time reset: re-attest with correct APT derivation\n    SecureStore.deleteItemAsync('kv_arweave_attested').catch(() => {});\n    setArweaveAttested(false);");
  console.log('3. Reset kv_arweave_attested for correct re-attestation');
} else { console.log('3. SKIP'); }

fs.writeFileSync('ProfileScreen.tsx', c);
console.log('Done');
