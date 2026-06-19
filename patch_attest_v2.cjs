const fs = require('fs');
let c = fs.readFileSync('ProfileScreen.tsx', 'utf8');
// One-time: clear old flag so auto-attest fires again with correct tags
if (c.includes("if (v === 'true') { setArweaveAttested(true); return; }")) {
  c = c.replace(
    "if (v === 'true') { setArweaveAttested(true); return; }",
    "// Reset once for App-Name fix\n        if (v === 'v2') { setArweaveAttested(true); return; }"
  );
  console.log('Reset attest flag to v2');
}
// Also update the set call to use v2
c = c.replace(
  "await SecureStore.setItemAsync('kv_arweave_attested', 'true');",
  "await SecureStore.setItemAsync('kv_arweave_attested', 'v2');"
);
console.log('Updated flag to v2');
fs.writeFileSync('ProfileScreen.tsx', c);
