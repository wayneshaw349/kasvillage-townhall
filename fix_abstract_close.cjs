// fix_abstract_close.cjs — close button on the abstract view.
const fs = require('fs');
const F = 'VillageMailbox.tsx';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('KV_ACAD_CLOSE')) { console.log('already patched'); process.exit(0); }

const A = "                  <ScrollView contentContainerStyle={{ padding: rs.s(18) }}>\n                    <Text style={{ fontSize: rs.font(16), fontWeight: '900', color: '#292524' }}>";
const c = s.split(A).length - 1;
if (c !== 1) { console.error('ANCHOR count =', c, '- expected 1. Aborting.'); process.exit(1); }
const B = "                  <ScrollView contentContainerStyle={{ padding: rs.s(18) }}>\n                    {/* KV_ACAD_CLOSE */}\n                    <TouchableOpacity onPress={() => setStoreView(null)} style={{ alignSelf: 'flex-end', paddingHorizontal: rs.s(10), paddingVertical: rs.s(4), backgroundColor: '#e7e5e4', borderRadius: rs.s(14) }}>\n                      <Text style={{ fontSize: rs.font(13), fontWeight: 'bold', color: '#57534e' }}>\\u2715</Text>\n                    </TouchableOpacity>\n                    <Text style={{ fontSize: rs.font(16), fontWeight: '900', color: '#292524' }}>";

s = s.split(A).join(B);
fs.writeFileSync(F, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log('patched: abstract view has a close button');
