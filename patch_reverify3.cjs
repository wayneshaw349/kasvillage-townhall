const fs = require('fs');
let c = fs.readFileSync('townhallscreen.tsx', 'utf8');

// Find the alreadyVerified View block and add a button after it
const target = "            </View>\n          ) : traitCount >= 6";
const replacement = `            </View>
          )}
          {isVerified && (
            <TouchableOpacity
              style={{ backgroundColor: '#F59E0B', borderRadius: 10, padding: 12, marginTop: 10, alignItems: 'center' }}
              onPress={async () => { await SecureStore.deleteItemAsync('kv_townhall_verified'); setIsVerified(false); }}
            >
              <Text style={{ color: '#000', fontWeight: '700' }}>Re-verify + Inscribe to Arweave</Text>
            </TouchableOpacity>
          )}
          {!isVerified && traitCount >= 6`;

if (c.includes(target)) {
  c = c.replace(target, replacement);
  fs.writeFileSync('townhallscreen.tsx', c);
  console.log('OK: re-verify button added cleanly');
} else {
  console.log('FAIL: target not found');
  const idx = c.indexOf('</View>');
  const idx2 = c.indexOf('traitCount >= 6', c.indexOf('alreadyVerified'));
  console.log('Indices:', idx, idx2);
}
