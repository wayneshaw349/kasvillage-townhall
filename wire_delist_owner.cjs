// wire_delist_owner.cjs — owner-only Delist button in the store/abstract
// modal. Posts the signed {k:'delist', d:{head: storeAddress}} record to the
// store registry via the existing delistFromRegistry. Ownership is checked
// at press (and enforced reader-side anyway - the directory ignores delists
// whose signer is not the publisher or the moderation key). Soft delist:
// directory curation only - chain data, installs, and the pledge untouched.
const fs = require('fs');
const F = 'VillageMailbox.tsx';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('KV_DELIST_OWNER')) { console.log('already patched'); process.exit(0); }

const edits = [
  // 1. handler before tipKeeper
  [
`  const tipKeeper = (entry: any, addrOverride?: string) => {`,
`  // KV_DELIST_OWNER: publisher-key soft delist from the modal
  const runDelistOwner = async (entry: any, kind: string) => {
    try {
      const ps = require('./proposal_share');
      const SS = require('expo-secure-store');
      const sender = (await SS.getItemAsync('kv_kaspa_address')) || (await SS.getItemAsync('kaspa_address'));
      const priv = await ps._kvResolvePrivHex();
      if (!sender || !priv) throw new Error('wallet identity unavailable');
      const { bytesToHex, hexToBytes } = require('@noble/hashes/utils');
      const { secp256k1 } = require('@noble/curves/secp256k1');
      const pub = bytesToHex(secp256k1.getPublicKey(hexToBytes(priv), true));
      if (entry.ownerPubkey && String(entry.ownerPubkey) !== pub) { Alert.alert('Not your listing', 'Only the publisher key can delist. Readers ignore delists from other keys.'); return; }
      Alert.alert('Delist this listing?', 'It disappears from every Mailbox directory (a newer announce restores it). Chain data, installs and your pledge are untouched. ~1 KAS.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delist', style: 'destructive', onPress: async () => {
          try {
            const { delistFromRegistry } = require('./payload_publish');
            const r: any = await delistFromRegistry({ privateKeyHex: priv, pubkeyHex: pub, address: sender, network: 'testnet-10' as any }, String(entry.arweaveTx || entry.id), kind);
            if (r && r.success === false) throw new Error(String(r.error || 'send failed'));
            console.log('[DelistOwner]', String(entry.arweaveTx || entry.id).slice(0, 24), kind);
            setStoreView(null);
            Alert.alert('Delisted', 'Posted to the registry. Lanes drop it on the next refresh.');
          } catch (e: any) { Alert.alert('Delist failed', String((e && e.message) || e)); }
        } },
      ]);
    } catch (e: any) { Alert.alert('Delist failed', String((e && e.message) || e)); }
  };
  const tipKeeper = (entry: any, addrOverride?: string) => {`,
  ],
  // 2. button in the abstract branch, under Repost
  [
`                    <TouchableOpacity disabled={repostBusy} onPress={() => runRepost(storeView.entry as any, 'store')} style={{ marginTop: rs.s(8), borderWidth: 1, borderColor: '#4f46e5', borderRadius: rs.s(10), paddingVertical: rs.s(10), alignItems: 'center' }}>
                      <Text style={{ color: '#4f46e5', fontSize: rs.font(11), fontWeight: 'bold' }}>{repostBusy ? 'Reposting...' : 'Repost \\u2014 keep this listing alive (1 KAS)'}</Text>
                    </TouchableOpacity>`,
`                    <TouchableOpacity disabled={repostBusy} onPress={() => runRepost(storeView.entry as any, 'store')} style={{ marginTop: rs.s(8), borderWidth: 1, borderColor: '#4f46e5', borderRadius: rs.s(10), paddingVertical: rs.s(10), alignItems: 'center' }}>
                      <Text style={{ color: '#4f46e5', fontSize: rs.font(11), fontWeight: 'bold' }}>{repostBusy ? 'Reposting...' : 'Repost \\u2014 keep this listing alive (1 KAS)'}</Text>
                    </TouchableOpacity>
                    {/* KV_DELIST_OWNER */}
                    <TouchableOpacity onPress={() => runDelistOwner(storeView.entry as any, 'store')} style={{ marginTop: rs.s(8), borderWidth: 1, borderColor: '#b91c1c', borderRadius: rs.s(10), paddingVertical: rs.s(10), alignItems: 'center' }}>
                      <Text style={{ color: '#b91c1c', fontSize: rs.font(11), fontWeight: 'bold' }}>Delist (owner only, ~1 KAS)</Text>
                    </TouchableOpacity>`,
  ],
  // 3. button in the store branch, under Repost
  [
`                    <TouchableOpacity disabled={repostBusy} onPress={() => runRepost(storeView.entry as any, 'store')} style={{ borderWidth: 1, borderColor: '#4f46e5', borderRadius: rs.s(10), paddingVertical: rs.s(8), alignItems: 'center' }}>
                      <Text style={{ color: '#4f46e5', fontSize: rs.font(10), fontWeight: 'bold' }}>{repostBusy ? 'Reposting...' : 'Repost \\u2014 keep this listing alive (1 KAS)'}</Text>
                    </TouchableOpacity>`,
`                    <TouchableOpacity disabled={repostBusy} onPress={() => runRepost(storeView.entry as any, 'store')} style={{ borderWidth: 1, borderColor: '#4f46e5', borderRadius: rs.s(10), paddingVertical: rs.s(8), alignItems: 'center' }}>
                      <Text style={{ color: '#4f46e5', fontSize: rs.font(10), fontWeight: 'bold' }}>{repostBusy ? 'Reposting...' : 'Repost \\u2014 keep this listing alive (1 KAS)'}</Text>
                    </TouchableOpacity>
                    {/* KV_DELIST_OWNER store */}
                    <TouchableOpacity onPress={() => runDelistOwner(storeView.entry as any, 'store')} style={{ marginTop: rs.s(6), borderWidth: 1, borderColor: '#b91c1c', borderRadius: rs.s(10), paddingVertical: rs.s(7), alignItems: 'center' }}>
                      <Text style={{ color: '#b91c1c', fontSize: rs.font(10), fontWeight: 'bold' }}>Delist (owner only, ~1 KAS)</Text>
                    </TouchableOpacity>`,
  ],
];

let ok = true;
for (let i = 0; i < edits.length; i++) {
  const c = s.split(edits[i][0]).length - 1;
  if (c !== 1) { console.error('ANCHOR ' + (i + 1) + ' count = ' + c + ' - expected 1.'); ok = false; }
}
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const [a, b] of edits) s = s.split(a).join(b);
fs.writeFileSync(F, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log('patched: owner Delist button in the store/abstract modal');
