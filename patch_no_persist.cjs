const fs = require('fs');
let c = fs.readFileSync('townhallscreen.tsx', 'utf8');
// Remove the persistence — just don't save kv_townhall_verified
// so Verify Now always shows (proof inscription is what matters, not local state)
c = c.replace("SecureStore.setItemAsync('kv_townhall_verified', 'true');", "// kv_townhall_verified saved after Arweave inscription");
c = c.replace("SecureStore.getItemAsync('kv_townhall_verified').then(v => { if (v === 'true') setIsVerified(true); });", "// Verification state from Arweave, not local");
fs.writeFileSync('townhallscreen.tsx', c);
console.log('OK: removed premature persistence');
