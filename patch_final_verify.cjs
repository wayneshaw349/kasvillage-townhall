const fs = require('fs');
let c = fs.readFileSync('townhallscreen.tsx', 'utf8');

// 1. Remove broken persistence useEffect
const brokenEffect = c.indexOf("SecureStore.getItemAsync('kv_townhall_verified')");
if (brokenEffect > -1) {
  // Find the full useEffect line(s) and replace
  const effectStart = c.lastIndexOf('useEffect', brokenEffect);
  const effectEnd = c.indexOf(']);', brokenEffect) + 3;
  c = c.substring(0, effectStart) + '// Verification from Arweave, not local flag' + c.substring(effectEnd);
  console.log('1. Removed broken persistence');
}

// 2. Add re-verify button inside the alreadyVerified View
const verifiedText = c.indexOf('visible in search.');
const textClose = c.indexOf('</Text>', verifiedText);
const viewClose = c.indexOf('</View>', textClose);

if (viewClose > -1 && !c.includes('Re-verify')) {
  const button = `
              <TouchableOpacity
                style={{ backgroundColor: '#F59E0B', borderRadius: 10, padding: 12, marginTop: 10, alignItems: 'center', width: '100%' }}
                onPress={() => { setIsVerified(false); }}
              >
                <Text style={{ color: '#000', fontWeight: '700', fontSize: 13 }}>Re-verify + Inscribe to Arweave</Text>
              </TouchableOpacity>
            `;
  c = c.substring(0, viewClose) + button + c.substring(viewClose);
  console.log('2. Added re-verify button');
}

// 3. Change alreadyVerified style from flexDirection row to column (so button fits)
c = c.replace(
  /alreadyVerified: \{\s*flexDirection: 'row',/,
  "alreadyVerified: {\n    flexDirection: 'column',"
);
console.log('3. Changed layout to column');

fs.writeFileSync('townhallscreen.tsx', c);
console.log('Done');
