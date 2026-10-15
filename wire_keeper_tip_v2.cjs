// wire_keeper_tip_v2.cjs — keeper tipping v2.
//  kaspa_payload.ts: KV_KEEPERS - each directory entry carries ALL distinct
//    keeper wallets that announced it in the window (not just the newest),
//    so early keepers keep their credit.
//  mailbox_kaspa_api.ts: keepers passed through to the items (3 lanes).
//  VillageMailbox.tsx: KV_KEEPER_TIP - dedicated tip popup (own <Modal>, so
//    it renders ABOVE the store/abstract modal): preset 1/5/25 KAS + custom
//    amount, sends straight from the wallet. Keeper bars list every keeper,
//    each tippable.
const fs = require('fs');

const jobs = [
  {
    f: 'kaspa_payload.ts',
    marker: 'KV_KEEPERS',
    edits: [
      // 1. pre-pass: distinct senders per store address
      [
`  const entries: DirectoryEntry[] = [];`,
`  // KV_KEEPERS: every distinct wallet that announced each listing in the window
  const _keepersBy = new Map<string, string[]>();
  for (const a of anns) {
    const _kr: any = a.record;
    if (!_kr || _kr.k !== 'registry' || !_kr.d || !_kr.d.storeAddress) continue;
    const _ks = String((a as any).sender || '');
    if (!_ks) continue;
    const _kk = String(_kr.d.storeAddress);
    const _karr = _keepersBy.get(_kk) || [];
    if (_karr.indexOf(_ks) < 0) _karr.push(_ks);
    _keepersBy.set(_kk, _karr);
  }
  const entries: DirectoryEntry[] = [];`,
      ],
      // 2. interface
      [
`  repostedBy?: string; // KV_REPOST_ATTR: keeper wallet address when the announce sender != the author
}`,
`  repostedBy?: string; // KV_REPOST_ATTR: keeper wallet address when the announce sender != the author
  keepers?: string[];  // KV_KEEPERS: all distinct keeper wallets in the window
}`,
      ],
      // 3. loop: compute keepers alongside repostedBy
      [
`    // KV_REPOST_ATTR: announce sender != author's own wallet => a keeper replayed it
    let _repostedBy = '';
    try {
      const _snd = String((_ent as any).sender || '');
      if (_snd) {
        const { deriveAddress } = require('./canonical_agreement_steps');
        const _xo = String(owner || '').length === 66 ? String(owner).slice(2) : String(owner || '');
        const _ownAddr = deriveAddress(_xo, network as any);
        if (_ownAddr && _snd !== _ownAddr) _repostedBy = _snd;
      }
    } catch {}`,
`    // KV_REPOST_ATTR: announce sender != author's own wallet => a keeper replayed it
    let _repostedBy = '';
    let _keepers: string[] = [];
    try {
      const { deriveAddress } = require('./canonical_agreement_steps');
      const _xo = String(owner || '').length === 66 ? String(owner).slice(2) : String(owner || '');
      const _ownAddr = deriveAddress(_xo, network as any);
      const _snd = String((_ent as any).sender || '');
      if (_ownAddr && _snd && _snd !== _ownAddr) _repostedBy = _snd;
      _keepers = (_keepersBy.get(String(record.d.storeAddress)) || []).filter((_s2: string) => _s2 && _s2 !== _ownAddr);
    } catch {}`,
      ],
      // 4. entry push
      [
`      repostedBy: _repostedBy,
    });`,
`      repostedBy: _repostedBy,
      keepers: _keepers,
    });`,
      ],
    ],
  },
  {
    f: 'mailbox_kaspa_api.ts',
    marker: 'keepers: e.keepers',
    editsAll: [
      [
`record: e.record, repostedBy: e.repostedBy || '', // KV_REPOST_ITEM`,
`record: e.record, repostedBy: e.repostedBy || '', keepers: e.keepers || [], // KV_REPOST_ITEM`,
        3,
      ],
    ],
  },
  {
    f: 'VillageMailbox.tsx',
    marker: 'KV_KEEPER_TIP',
    edits: [
      // 1. replace tipKeeper with popup state + direct sender
      [
`  const tipKeeper = (entry: any) => {
    const addr = entry && entry.repostedBy;
    if (!addr) return;
    setTipAmt(''); setTipT({ ...entry, name: 'Keeper of ' + String(entry.name || entry.storeName || entry.title || 'listing'), quad: { tip_addr: addr } });
  };`,
`  // KV_KEEPER_TIP: dedicated popup (own Modal, renders above the store view)
  const [keeperTip, setKeeperTip] = useState<any>(null);
  const [keeperAmt, setKeeperAmt] = useState('');
  const [keeperBusy, setKeeperBusy] = useState(false);
  const tipKeeper = (entry: any, addrOverride?: string) => {
    const addr = addrOverride || (entry && entry.repostedBy);
    if (!addr) return;
    setKeeperAmt(''); setKeeperTip({ addr: String(addr), name: String((entry && (entry.name || entry.storeName || entry.title)) || 'listing') });
  };
  const sendKeeperTip = async () => {
    const kas = Number(keeperAmt || '0');
    if (!keeperTip) return;
    if (!(kas > 0) || kas > 5000) { Alert.alert('Invalid amount', 'Enter between 0 and 5000 KAS.'); return; }
    setKeeperBusy(true);
    try {
      const ps = require('./proposal_share');
      const SS = require('expo-secure-store');
      const sender = (await SS.getItemAsync('kv_kaspa_address')) || (await SS.getItemAsync('kaspa_address'));
      const priv = await ps._kvResolvePrivHex();
      if (!sender || !priv) throw new Error('wallet identity unavailable');
      const { sendKaspaViaRest } = require('./kaspa_rest_tx');
      const r: any = await sendKaspaViaRest({ senderAddress: sender, recipientAddress: String(keeperTip.addr), amountSompi: BigInt(Math.round(kas * 1e8)), privateKeyHex: priv, network: 'testnet-10' as any });
      if (r && r.success === false) throw new Error(String(r.error || 'send failed'));
      console.log('[KeeperTip]', kas, 'KAS ->', String(keeperTip.addr).slice(0, 24));
      setKeeperTip(null);
      Alert.alert('Tip sent \\u2713', kas + ' KAS to the keeper of "' + keeperTip.name + '". Tips are what keep listings alive.');
    } catch (e: any) { Alert.alert('Tip failed', String((e && e.message) || e)); }
    setKeeperBusy(false);
  };`,
      ],
      // 2. abstract-branch pill -> keepers list
      [
`                    {(storeView.entry as any).repostedBy ? (
                      <TouchableOpacity onPress={() => tipKeeper(storeView.entry)} style={{ marginTop: rs.s(12), borderWidth: 1, borderColor: '#d97706', borderRadius: rs.s(10), paddingVertical: rs.s(10), alignItems: 'center' }}>
                        <Text style={{ color: '#d97706', fontSize: rs.font(11), fontWeight: 'bold' }}>REPOST by {String((storeView.entry as any).repostedBy).slice(10, 26)}... {'\\u2014'} Tip the keeper</Text>
                      </TouchableOpacity>
                    ) : null}`,
`                    {(((storeView.entry as any).keepers || []) as string[]).length > 0 ? (
                      <View style={{ marginTop: rs.s(12) }}>
                        <Text style={{ color: '#d97706', fontSize: rs.font(10), fontWeight: 'bold' }}>Kept alive by {(((storeView.entry as any).keepers || []) as string[]).length} keeper(s)</Text>
                        {(((storeView.entry as any).keepers || []) as string[]).slice(0, 5).map((_ka: string, _ki: number) => (
                          <TouchableOpacity key={_ki} onPress={() => tipKeeper(storeView.entry, _ka)} style={{ marginTop: rs.s(6), borderWidth: 1, borderColor: '#d97706', borderRadius: rs.s(10), paddingVertical: rs.s(8), alignItems: 'center' }}>
                            <Text style={{ color: '#d97706', fontSize: rs.font(10), fontWeight: 'bold' }}>{_ka.slice(10, 30)}... {'\\u2014'} Tip this keeper</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : null}`,
      ],
      // 3. store-branch pill -> keepers list
      [
`                    {(storeView.entry as any).repostedBy ? (
                      <TouchableOpacity onPress={() => tipKeeper(storeView.entry)} style={{ borderWidth: 1, borderColor: '#d97706', borderRadius: rs.s(10), paddingVertical: rs.s(8), alignItems: 'center', marginBottom: rs.s(6) }}>
                        <Text style={{ color: '#d97706', fontSize: rs.font(10), fontWeight: 'bold' }}>REPOST by {String((storeView.entry as any).repostedBy).slice(10, 26)}... {'\\u2014'} Tip the keeper</Text>
                      </TouchableOpacity>
                    ) : null}`,
`                    {(((storeView.entry as any).keepers || []) as string[]).length > 0 ? (
                      <View style={{ marginBottom: rs.s(6) }}>
                        <Text style={{ color: '#d97706', fontSize: rs.font(9), fontWeight: 'bold' }}>Kept alive by {(((storeView.entry as any).keepers || []) as string[]).length} keeper(s)</Text>
                        {(((storeView.entry as any).keepers || []) as string[]).slice(0, 5).map((_ka: string, _ki: number) => (
                          <TouchableOpacity key={_ki} onPress={() => tipKeeper(storeView.entry, _ka)} style={{ marginTop: rs.s(4), borderWidth: 1, borderColor: '#d97706', borderRadius: rs.s(10), paddingVertical: rs.s(7), alignItems: 'center' }}>
                            <Text style={{ color: '#d97706', fontSize: rs.font(9), fontWeight: 'bold' }}>{_ka.slice(10, 30)}... {'\\u2014'} Tip this keeper</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : null}`,
      ],
      // 4. the popup itself, above the store modal
      [
`      <Modal visible={!!storeView} animationType="slide" transparent onRequestClose={() => setStoreView(null)}>`,
`      {/* KV_KEEPER_TIP popup - own Modal so it stacks above the store view */}
      <Modal visible={!!keeperTip} animationType="fade" transparent onRequestClose={() => setKeeperTip(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(28,25,23,0.7)', justifyContent: 'center', padding: rs.s(24) }}>
          <View style={{ backgroundColor: '#fff', borderRadius: rs.s(16), padding: rs.s(18) }}>
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
          </View>
        </View>
      </Modal>
      <Modal visible={!!storeView} animationType="slide" transparent onRequestClose={() => setStoreView(null)}>`,
      ],
    ],
  },
];

let ok = true;
const staged = [];
for (const j of jobs) {
  let s = fs.readFileSync(j.f, 'utf8');
  const CRLF = s.includes('\r\n');
  if (CRLF) s = s.replace(/\r\n/g, '\n');
  if (s.includes(j.marker)) { console.log(j.f + ': already patched - skipping'); continue; }
  for (const [a, , want] of (j.editsAll || [])) {
    const c = s.split(a).length - 1;
    if (c !== want) { console.error(j.f + ' ALL-ANCHOR count = ' + c + ' - expected ' + want + '.'); ok = false; }
  }
  for (let i = 0; i < (j.edits || []).length; i++) {
    const c = s.split(j.edits[i][0]).length - 1;
    if (c !== 1) { console.error(j.f + ' ANCHOR ' + (i + 1) + ' count = ' + c + ' - expected 1.'); ok = false; }
  }
  staged.push({ ...j, s, CRLF });
}
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const j of staged) {
  let s = j.s;
  for (const [a, b] of (j.editsAll || [])) s = s.split(a).join(b);
  for (const [a, b] of (j.edits || [])) s = s.split(a).join(b);
  fs.writeFileSync(j.f, j.CRLF ? s.replace(/\n/g, '\r\n') : s);
  console.log(j.f + ': patched');
}
console.log('DONE - keeper tip popup (preset + custom amount) and full keepers list.');
