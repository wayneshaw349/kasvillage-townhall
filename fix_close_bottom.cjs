// fix_close_bottom.cjs — big Close button at the bottom of the abstract view.
const fs = require('fs');
const F = 'VillageMailbox.tsx';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('KV_ACAD_CLOSE_BTM')) { console.log('already patched'); process.exit(0); }

const A = "                    <View style={{ height: rs.s(24) }} />\n                  </ScrollView>";
const c = s.split(A).length - 1;
if (c !== 1) { console.error('ANCHOR count =', c, '- expected 1. Aborting.'); process.exit(1); }
const B = "                    {/* KV_ACAD_CLOSE_BTM */}\n                    <TouchableOpacity onPress={() => setStoreView(null)} style={{ marginTop: rs.s(16), backgroundColor: '#57534e', borderRadius: rs.s(12), paddingVertical: rs.s(14), alignItems: 'center' }}>\n                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: rs.font(14) }}>Close</Text>\n                    </TouchableOpacity>\n                    <View style={{ height: rs.s(24) }} />\n                  </ScrollView>";

s = s.split(A).join(B);
fs.writeFileSync(F, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log('patched: Close button at the bottom of the abstract view');
