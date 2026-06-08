const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "AppNaviagator.tsx");
if (!fs.existsSync(file)) { console.log("⚠️  AppNaviagator.tsx not found"); process.exit(1); }
let s = fs.readFileSync(file, "utf8");
let fixes = 0;

// PATCH 1: Add import for device attestation
const importAnchor = "import { getBalance as getKaspaBalance, setNetwork } from './kaspa_unified';";
const importAdd = `import { getBalance as getKaspaBalance, setNetwork } from './kaspa_unified';
import { getDeviceHash, getSerialHash } from './device_attestation';`;

if (s.includes(importAnchor) && !s.includes("getDeviceHash")) {
  s = s.replace(importAnchor, importAdd);
  fixes++;
  console.log("  → import added for device_attestation");
}

// PATCH 2: Wire attestation into boot sequence (after biometric success, before quiz)
// Find handleBiometricSuccess and add attestation check
const bioAnchor = `const handleBiometricSuccess = useCallback(() => {
    setScreen('quiz_gate');
  }, []);`;

const bioReplace = `const handleBiometricSuccess = useCallback(() => {
    // Device attestation check (non-blocking)
    (async () => {
      try {
        const deviceHash = await getDeviceHash();
        const serialHash = await getSerialHash();
        console.log('[DeviceAttestation] deviceHash:', deviceHash?.slice(0, 16) || 'none');
        console.log('[DeviceAttestation] serialHash:', serialHash?.slice(0, 16) || 'none');
        if (deviceHash) await SecureStore.setItemAsync('kv_last_device_hash', deviceHash);
      } catch (attErr) {
        console.warn('[DeviceAttestation] Check failed (non-fatal):', attErr);
      }
    })();
    setScreen('quiz_gate');
  }, []);`;

if (s.includes(bioAnchor)) {
  s = s.replace(bioAnchor, bioReplace);
  fixes++;
  console.log("  → Attestation wired into handleBiometricSuccess");
} else {
  console.log("  ⚠️  handleBiometricSuccess anchor not found");
}

if (fixes > 0) {
  fs.writeFileSync(file, s, "utf8");
  console.log(`✅ AppNaviagator.tsx — ${fixes} patches applied`);
} else {
  console.log("⚠️  No patches applied");
}
