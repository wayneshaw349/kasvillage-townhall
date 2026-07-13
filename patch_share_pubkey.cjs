const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let c = fs.readFileSync(f, 'utf8');

if (c.includes('SHARE_MY_PUBKEY_BTN')) { console.error('ABORT: already patched'); process.exit(1); }

// Anchor: the opening of the counterparty field View + label, uniquely identified by the relabeled label.
const anchor = `<View style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: rs.font(12), fontWeight: 'bold', color: COLORS.stone600, marginBottom: 4 }}>Seller's Response (pubkey)</Text>`;
const n = c.split(anchor).length - 1;
if (n !== 1) { console.error('ABORT: anchor count = ' + n); process.exit(1); }

const btn = `<View style={{ marginBottom: 16 }}>
                    {/* SHARE_MY_PUBKEY_BTN */}
                    <TouchableOpacity
                      onPress={async () => {
                        try {
                          const myPub = await SecureStore.getItemAsync('kaspa_pubkey');
                          if (myPub) {
                            await Clipboard.setStringAsync(myPub);
                            Alert.alert('Copied', 'Your pubkey is copied. Send it to your counterparty so they can build the FROST address.');
                          } else {
                            Alert.alert('Not found', 'Your pubkey is not available yet.');
                          }
                        } catch (e) { console.warn('[SharePubkey] failed:', e); }
                      }}
                      style={{ backgroundColor: COLORS.indigo50, borderWidth: 1, borderColor: COLORS.indigo200, borderRadius: 12, paddingVertical: 10, marginBottom: 10, alignItems: 'center' }}
                    >
                      <Text style={{ fontSize: rs.font(12), fontWeight: 'bold', color: COLORS.indigo600 }}>Share my pubkey</Text>
                    </TouchableOpacity>
                    <Text style={{ fontSize: rs.font(12), fontWeight: 'bold', color: COLORS.stone600, marginBottom: 4 }}>Seller's Response (pubkey)</Text>`;

c = c.replace(anchor, btn);
fs.writeFileSync(f, c);
console.log('OK — Share my pubkey button added above the field');
