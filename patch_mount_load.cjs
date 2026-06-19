const fs = require('fs');
let c = fs.readFileSync('townhallscreen.tsx', 'utf8');
const stateDecl = "const [isVerified, setIsVerified] = useState(false);";
if (c.includes(stateDecl) && !c.includes("getItemAsync('kv_townhall_verified')")) {
  c = c.replace(stateDecl, stateDecl + "\n  useEffect(() => { SecureStore.getItemAsync('kv_townhall_verified').then(v => { if (v === 'true') setIsVerified(true); }); }, []);");
  console.log('Mount load added');
} else {
  console.log('Already has mount load or state not found');
}
fs.writeFileSync('townhallscreen.tsx', c);
