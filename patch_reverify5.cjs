const fs = require('fs');
let c = fs.readFileSync('townhallscreen.tsx', 'utf8');

// Find the alreadyVerifiedText closing tag and insert button before </View>
const textEnd = c.indexOf('</Text>', c.indexOf('visible in search'));
const viewEnd = c.indexOf('</View>', textEnd);

if (viewEnd > -1 && !c.includes('Re-verify')) {
  const button = `
              <TouchableOpacity
                style={{ backgroundColor: '#F59E0B', borderRadius: 10, padding: 12, marginTop: 10, alignItems: 'center' }}
                onPress={async () => { await SecureStore.deleteItemAsync('kv_townhall_verified'); setIsVerified(false); }}
              >
                <Text style={{ color: '#000', fontWeight: '700' }}>Re-verify + Inscribe to Arweave</Text>
              </TouchableOpacity>
`;
  c = c.substring(0, viewEnd) + button + c.substring(viewEnd);
  fs.writeFileSync('townhallscreen.tsx', c);
  console.log('OK');
}
