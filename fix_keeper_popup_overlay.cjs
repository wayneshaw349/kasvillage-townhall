// fix_keeper_popup_overlay.cjs — iOS will not present a sibling <Modal>
// while the store/abstract Modal is already up, so the keeper-tip popup
// never appeared. Move it INSIDE the store modal as an absolute overlay
// (zIndex+elevation) - no modal stacking, works on both platforms.
const fs = require('fs');
const F = 'VillageMailbox.tsx';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('KV_KEEPER_TIP2')) { console.log('already patched'); process.exit(0); }

const CARD = `            <View style={{ backgroundColor: '#fff', borderRadius: rs.s(16), padding: rs.s(18) }}>
              <Text style={{ fontWeight: '900', fontSize: rs.font(14), color: '#292524' }}>Tip the keeper</Text>
              <Text style={{ fontSize: rs.font(10), color: '#78716c', marginTop: rs.s(4) }}>{keeperTip ? 'Keeper of "' + keeperTip.name + '"' : ''}</Text>
              <Text style={{ fontSize: rs.font(9), color: '#a8a29e', marginTop: rs.s(2) }}>{keeperTip ? String(keeperTip.addr) : ''}</Text>
              <View style={{ flexDirection: 'row', gap: rs.s(8), marginTop: rs.s(12) }}>
                {['1', '5', '25'].map((v) => (
                  <TouchableOpacity key={v} onPress={() => setKeeperAmt(v)} style={{ flex: 1, borderWidth: 1, borderColor: keeperAmt === v ? '#4f46e5' : '#d6d3d1', borderRadius: rs.s(10), paddingVertical: rs.s(8), alignItems: 'center' }}>
                    <Text style={{ fontWeight: 'bold', fontSize: rs.font(11), color: keeperAmt === v ? '#4f46e5' : '#57534e' }}>{v} KAS</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput value={keeperAmt} onChangeText={setKeeperAmt} keyboardType="decimal-pad" placeholder="Custom amount (KAS)" placeholderTextColor="#a8a29e" style={{ borderWidth: 1, borderColor: '#d6d3d1', borderRadius: rs.s(10), marginTop: rs.s(10), padding: rs.s(10), color: '#292524', fontSize: rs.font(12) }} />
              <View style={{ flexDirection: 'row', gap: rs.s(8), marginTop: rs.s(12) }}>
                <TouchableOpacity onPress={() => setKeeperTip(null)} style={{ flex: 1, backgroundColor: '#e7e5e4', borderRadius: rs.s(10), paddingVertical: rs.s(12), alignItems: 'center' }}>
                  <Text style={{ fontWeight: 'bold', color: '#57534e', fontSize: rs.font(12) }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity disabled={keeperBusy} onPress={sendKeeperTip} style={{ flex: 1, backgroundColor: '#4f46e5', borderRadius: rs.s(10), paddingVertical: rs.s(12), alignItems: 'center' }}>
                  <Text style={{ fontWeight: 'bold', color: '#fff', fontSize: rs.font(12) }}>{keeperBusy ? 'Sending...' : 'Send Tip'}</Text>
                </TouchableOpacity>
              </View>
            </View>`;

// 1. strip the sibling Modal version (head + tail anchors; body between is known but long)
const A1_START = `      {/* KV_KEEPER_TIP popup - own Modal so it stacks above the store view */}`;
const A1_END = `      </Modal>
      <Modal visible={!!storeView} animationType="slide" transparent onRequestClose={() => setStoreView(null)}>`;
const i1 = s.indexOf(A1_START);
const i2 = s.indexOf(A1_END);
if (i1 < 0 || i2 < 0 || i2 < i1) { console.error('sibling-popup anchors not found (start ' + i1 + ' end ' + i2 + '). Aborting.'); process.exit(1); }
s = s.slice(0, i1) + `      <Modal visible={!!storeView} animationType="slide" transparent onRequestClose={() => setStoreView(null)}>` + s.slice(i2 + A1_END.length);

// 2. overlay inside the store modal root
const A2 = `        <View style={{ flex: 1, backgroundColor: 'rgba(28,25,23,0.85)', justifyContent: 'flex-end' }}>`;
const c2 = s.split(A2).length - 1;
if (c2 !== 1) { console.error('root ANCHOR count = ' + c2 + ' - expected 1. Aborting.'); process.exit(1); }
const B2 = A2 + `
          {/* KV_KEEPER_TIP2: overlay INSIDE the store modal - iOS cannot stack sibling Modals */}
          {keeperTip ? (
            <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(28,25,23,0.7)', justifyContent: 'center', padding: rs.s(24), zIndex: 999, elevation: 999 }}>
` + CARD + `
            </View>
          ) : null}`;
s = s.split(A2).join(B2);

fs.writeFileSync(F, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log('patched: keeper tip popup renders inside the store modal (overlay)');
