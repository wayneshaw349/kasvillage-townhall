const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let c = fs.readFileSync(f, 'utf8');

if (c.includes('SHARE_MY_PUBKEY_BTN')) { console.error('ABORT: already patched'); process.exit(1); }

// Byte-verified short anchor: the tail of the label element. Insert button BEFORE the label's <Text.
// We anchor on the full label <Text ...>Seller's Response...</Text> by locating its start via the unique tail.
const tail = ">Seller's Response (pubkey)</Text>";
const nTail = c.split(tail).length - 1;
if (nTail !== 1) { console.error('ABORT: tail anchor count = ' + nTail); process.exit(1); }

// Find the start of the <Text that ends with this tail, so we insert the button before the whole element.
const tailIdx = c.indexOf(tail);
const textStart = c.lastIndexOf('<Text', tailIdx);
if (textStart === -1) { console.error('ABORT: could not find <Text start'); process.exit(1); }

const btn = `{/* SHARE_MY_PUBKEY_BTN */}
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
                    `;

c = c.slice(0, textStart) + btn + c.slice(textStart);
fs.writeFileSync(f, c);
console.log('OK — Share my pubkey button inserted before the label');
