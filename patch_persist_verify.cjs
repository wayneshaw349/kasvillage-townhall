const fs = require('fs');
let c = fs.readFileSync('townhallscreen.tsx', 'utf8');

// 1. Load saved verification on mount
const loadHook = "const [isVerified, setIsVerified] = useState(false);";
if (c.includes(loadHook)) {
  c = c.replace(loadHook, 
    "const [isVerified, setIsVerified] = useState(false);\n  useEffect(() => { SecureStore.getItemAsync('kv_townhall_verified').then(v => { if (v === 'true') setIsVerified(true); }); }, []);");
  console.log('1. Load verification status on mount');
}

// 2. Save when verified
const verifySet = "setIsVerified(true);";
const firstIdx = c.indexOf(verifySet);
if (firstIdx > -1 && !c.includes("setItemAsync('kv_townhall_verified'")) {
  c = c.replace(verifySet, "setIsVerified(true);\n        SecureStore.setItemAsync('kv_townhall_verified', 'true');");
  console.log('2. Persist verification to SecureStore');
}

fs.writeFileSync('townhallscreen.tsx', c);
console.log('Done');
