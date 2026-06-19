const fs = require('fs');
let c = fs.readFileSync('townhallscreen.tsx', 'utf8');
// Save ONLY after Arweave inscription succeeds
const anchor = "console.log('[TownHall] Proof inscribed:', arweaveTxId);";
if (c.includes(anchor) && !c.includes("kv_townhall_verified")) {
  c = c.replace(anchor, anchor + "\n              await SecureStore.setItemAsync('kv_townhall_verified', 'true');\n              await SecureStore.setItemAsync('kv_verification_tx', arweaveTxId);");
  console.log('Save after Arweave inscription');
}
// Load on mount (but only if actually saved = actually on Arweave)
const stateDecl = "const [isVerified, setIsVerified] = useState(false);";
if (c.includes(stateDecl) && !c.includes("kv_townhall_verified")) {
  c = c.replace(stateDecl, stateDecl + "\n  useEffect(() => { SecureStore.getItemAsync('kv_townhall_verified').then(v => { if (v === 'true') setIsVerified(true); }); }, []);");
  console.log('Load on mount');
}
fs.writeFileSync('townhallscreen.tsx', c);
console.log('Done');
