// wire_category_picker.cjs — Storefront Workspace gets a CATEGORY chip row
// (there was no UI; every store published as 'General'). Feeds the mailbox
// lanes: 'Services' -> Services tab, 'Academic' -> Academics tab (DKIM-gated),
// everything else -> Stores tab. Prohibited categories are simply not options.
const fs = require('fs');
const F = 'Workspace.tsx';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('KV_STORE_CATEGORIES')) { console.log('already patched'); process.exit(0); }

const A = `              <InputField
                label="Store Description"
                value={storeDescription}
                onChangeText={setStoreDescription}
                placeholder="Tell customers about your store..."
                multiline
              />`;
const c = s.split(A).length - 1;
if (c !== 1) { console.error('ANCHOR count =', c, '- expected 1. Aborting.'); process.exit(1); }

const B = A + `

              {/* KV_STORE_CATEGORIES: category decides which mailbox lane lists this store */}
              <Text style={{ fontSize: rs.font(9), color: '#a8a29e', marginBottom: rs.s(4), marginTop: rs.s(6), fontWeight: '700' }}>CATEGORY</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: rs.s(6), marginBottom: rs.s(10) }}>
                {['General', 'Fashion', 'Food', 'Tech', 'Art', 'Services', 'Academic'].map((cat) => (
                  <TouchableOpacity key={cat} onPress={() => setStoreCategory(cat)}
                    style={{ paddingHorizontal: rs.s(10), paddingVertical: rs.s(6), borderRadius: 14, borderWidth: 1,
                      borderColor: storeCategory === cat ? '#7c5cff' : '#44403c',
                      backgroundColor: storeCategory === cat ? '#241f36' : 'transparent' }}>
                    <Text style={{ fontSize: rs.font(10), fontWeight: '700', color: storeCategory === cat ? '#b9a6ff' : '#a8a29e' }}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {storeCategory === 'Services' ? (
                <Text style={{ fontSize: rs.font(8), color: '#78716c', marginBottom: rs.s(8) }}>Listed in the Services tab. Pledge-anchored like any store.</Text>
              ) : null}
              {storeCategory === 'Academic' ? (
                <Text style={{ fontSize: rs.font(8), color: '#78716c', marginBottom: rs.s(8) }}>Listed in Academics only after DKIM verification.</Text>
              ) : null}`;

s = s.replace(A, B);
if (CRLF) s = s.replace(/\n/g, '\r\n');
fs.writeFileSync(F, s);
console.log('patched: category chip row in Storefront Workspace (General/Fashion/Food/Tech/Art/Services/Academic)');
