// wire_repost_mailbox.cjs — keeper/repost UI (2+3 of 3).
//  mailbox_kaspa_api.ts: storefront/dapp/academic items carry the ORIGINAL
//    signed record (for replay) and repostedBy (keeper wallet, from the
//    announce tx sender).
//  VillageMailbox.tsx:
//    - runRepost(entry, kind): replays the untouched record via
//      repostRecord() - your wallet becomes the listing's keeper.
//    - tipKeeper(entry): reuses the existing tip modal, routed to the
//      keeper's address (the repost tx sender - unforgeable).
//    - Keeper bar in the store/abstract modal: "REPOST by <addr> - Tip the
//      keeper" pill when reposted, and a Repost button on every listing.
const fs = require('fs');

const jobs = [
  {
    f: 'mailbox_kaspa_api.ts',
    marker: 'KV_REPOST_ITEM',
    edits: [
      // storefronts
      [
`      coords: (e.record && e.record.d && e.record.d.coords) || null,
    } as any));`,
`      coords: (e.record && e.record.d && e.record.d.coords) || null,
      record: e.record, repostedBy: e.repostedBy || '', // KV_REPOST_ITEM
    } as any));`,
      ],
      // dapps
      [
`        xpCommitment: Math.round(pledgeKas),
        gameHash,
      } as any;`,
`        xpCommitment: Math.round(pledgeKas),
        gameHash,
        record: e.record, repostedBy: e.repostedBy || '', // KV_REPOST_ITEM
      } as any;`,
      ],
      // academics
      [
`          createdAt: e.announcedAt * 1000,
          townhall: { verified: dkim, verifiedAt: e.announcedAt, verificationTx: e.storeAddress },
        } as any;`,
`          createdAt: e.announcedAt * 1000,
          townhall: { verified: dkim, verifiedAt: e.announcedAt, verificationTx: e.storeAddress },
          record: e.record, repostedBy: e.repostedBy || '', // KV_REPOST_ITEM
        } as any;`,
      ],
    ],
  },
  {
    f: 'VillageMailbox.tsx',
    marker: 'KV_REPOST_UI',
    edits: [
      // 1. handlers before tipDev
      [
`  const tipDev = (item: any) => {`,
`  // KV_REPOST_UI: keeper actions - replay a listing's signed record, tip a keeper
  const [repostBusy, setRepostBusy] = useState(false);
  const runRepost = async (entry: any, kind: string) => {
    const rec = entry && entry.record;
    if (!rec) { Alert.alert('Repost', 'Original record not loaded - refresh the lane and try again.'); return; }
    if (repostBusy) return;
    setRepostBusy(true);
    try {
      const ps = require('./proposal_share');
      const SS = require('expo-secure-store');
      const sender = (await SS.getItemAsync('kv_kaspa_address')) || (await SS.getItemAsync('kaspa_address'));
      const priv = await ps._kvResolvePrivHex();
      if (!sender || !priv) throw new Error('wallet identity unavailable');
      const { bytesToHex, hexToBytes } = require('@noble/hashes/utils');
      const { secp256k1 } = require('@noble/curves/secp256k1');
      const pub = bytesToHex(secp256k1.getPublicKey(hexToBytes(priv), true));
      const { repostRecord } = require('./payload_publish');
      const r: any = await repostRecord({ privateKeyHex: priv, pubkeyHex: pub, address: sender, network: 'testnet-10' as any }, rec, kind);
      if (r && r.success === false) throw new Error(String(r.error || 'send failed'));
      Alert.alert('Reposted \\u2713', 'You re-announced this listing to the chain (1 KAS). Your wallet is now its keeper - tips for keeping it alive come to you.');
    } catch (e: any) { Alert.alert('Repost failed', String((e && e.message) || e)); }
    setRepostBusy(false);
  };
  const tipKeeper = (entry: any) => {
    const addr = entry && entry.repostedBy;
    if (!addr) return;
    setTipAmt(''); setTipT({ ...entry, name: 'Keeper of ' + String(entry.name || entry.storeName || entry.title || 'listing'), quad: { tip_addr: addr } });
  };
  const tipDev = (item: any) => {`,
      ],
      // 2. keeper bar in the abstract branch (before the bottom Close)
      [
`                    {/* KV_ACAD_CLOSE_BTM */}`,
`                    {(storeView.entry as any).repostedBy ? (
                      <TouchableOpacity onPress={() => tipKeeper(storeView.entry)} style={{ marginTop: rs.s(12), borderWidth: 1, borderColor: '#d97706', borderRadius: rs.s(10), paddingVertical: rs.s(10), alignItems: 'center' }}>
                        <Text style={{ color: '#d97706', fontSize: rs.font(11), fontWeight: 'bold' }}>REPOST by {String((storeView.entry as any).repostedBy).slice(10, 26)}... {'\\u2014'} Tip the keeper</Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity disabled={repostBusy} onPress={() => runRepost(storeView.entry as any, 'store')} style={{ marginTop: rs.s(8), borderWidth: 1, borderColor: '#4f46e5', borderRadius: rs.s(10), paddingVertical: rs.s(10), alignItems: 'center' }}>
                      <Text style={{ color: '#4f46e5', fontSize: rs.font(11), fontWeight: 'bold' }}>{repostBusy ? 'Reposting...' : 'Repost \\u2014 keep this listing alive (1 KAS)'}</Text>
                    </TouchableOpacity>
                    {/* KV_ACAD_CLOSE_BTM */}`,
      ],
      // 3. keeper bar at the top of the storefront modal
      [
`              return (
                <View>
                  {/* Banner: graffiti SVG when selected, else styled text */}`,
`              return (
                <View>
                  {/* KV_REPOST_UI: keeper bar (stores) */}
                  <View style={{ paddingHorizontal: rs.s(14), paddingTop: rs.s(10) }}>
                    {(storeView.entry as any).repostedBy ? (
                      <TouchableOpacity onPress={() => tipKeeper(storeView.entry)} style={{ borderWidth: 1, borderColor: '#d97706', borderRadius: rs.s(10), paddingVertical: rs.s(8), alignItems: 'center', marginBottom: rs.s(6) }}>
                        <Text style={{ color: '#d97706', fontSize: rs.font(10), fontWeight: 'bold' }}>REPOST by {String((storeView.entry as any).repostedBy).slice(10, 26)}... {'\\u2014'} Tip the keeper</Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity disabled={repostBusy} onPress={() => runRepost(storeView.entry as any, 'store')} style={{ borderWidth: 1, borderColor: '#4f46e5', borderRadius: rs.s(10), paddingVertical: rs.s(8), alignItems: 'center' }}>
                      <Text style={{ color: '#4f46e5', fontSize: rs.font(10), fontWeight: 'bold' }}>{repostBusy ? 'Reposting...' : 'Repost \\u2014 keep this listing alive (1 KAS)'}</Text>
                    </TouchableOpacity>
                  </View>
                  {/* Banner: graffiti SVG when selected, else styled text */}`,
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
  for (let i = 0; i < j.edits.length; i++) {
    const c = s.split(j.edits[i][0]).length - 1;
    if (c !== 1) { console.error(j.f + ' ANCHOR ' + (i + 1) + ' count = ' + c + ' - expected 1.'); ok = false; }
  }
  staged.push({ ...j, s, CRLF });
}
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const j of staged) {
  let s = j.s;
  for (const [a, b] of j.edits) s = s.split(a).join(b);
  fs.writeFileSync(j.f, j.CRLF ? s.replace(/\n/g, '\r\n') : s);
  console.log(j.f + ': patched');
}
console.log('DONE - repost buttons + keeper tips in the Mailbox.');
