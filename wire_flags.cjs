// wire_flags.cjs — moderation step 2: community flags with a 3-flag tally.
// - payload_publish: flagListing(keys, head, reason, kind) posts {k:'flag', d:{head, reason}}
//   and clearFlags(keys, head, kind) posts {k:'flagclear', d:{head}} (mod key only counts).
// - kaspa_payload.rebuildDirectory (stores/services/academics/coupons/dapps): every wallet
//   tallies flags itself. A flag counts only if it is signed, its signer is a listed
//   publisher in this registry (reputation gate), and it is newer than the last mod clear.
//   Owner's own flags are ignored. 3 distinct flaggers = hidden, same as a delist.
// - VillageMailbox: "Flag" button next to Delist; mod key also gets "Clear all flags".
const fs = require('fs');
const MOD = '037d42aac927f9fad639cd0b479b3e921951d90361fd2e1e05d184f8122bf17133';

const jobs = [
  {
    f: 'payload_publish.ts',
    marker: 'KV_FLAGS_SEND',
    edits: [
      ["  console.log('[Delist]', head.slice(0, 10), '-> registry', regAddr.slice(0, 24));\n  return { ...res, registryAddr: regAddr };\n}",
       `  console.log('[Delist]', head.slice(0, 10), '-> registry', regAddr.slice(0, 24));
  return { ...res, registryAddr: regAddr };
}

// KV_FLAGS_SEND: community flag (counted by readers if the signer is a listed publisher)
export async function flagListing(owner: OwnerKeys, head: string, reason: string, kind: string = 'store') {
  const rec = signRecord({ v: 1, k: 'flag', t: Date.now(), o: owner.pubkeyHex, d: { head, reason } } as any, owner.privateKeyHex);
  const regAddr = registryAddress(kind, owner.network);
  const res = await sendKaspaViaRest({
    senderAddress: owner.address,
    recipientAddress: regAddr,
    amountSompi: ANNOUNCE_SOMPI,
    privateKeyHex: owner.privateKeyHex,
    network: owner.network,
    payload: buildPayloadHex(rec),
  });
  console.log('[Flag]', head.slice(0, 24), reason, '-> registry', regAddr.slice(0, 24));
  return { ...res, registryAddr: regAddr };
}

// Mod clear: flags older than this record stop counting (readers honor the mod key only)
export async function clearFlags(owner: OwnerKeys, head: string, kind: string = 'store') {
  const rec = signRecord({ v: 1, k: 'flagclear', t: Date.now(), o: owner.pubkeyHex, d: { head } } as any, owner.privateKeyHex);
  const regAddr = registryAddress(kind, owner.network);
  const res = await sendKaspaViaRest({
    senderAddress: owner.address,
    recipientAddress: regAddr,
    amountSompi: ANNOUNCE_SOMPI,
    privateKeyHex: owner.privateKeyHex,
    network: owner.network,
    payload: buildPayloadHex(rec),
  });
  console.log('[FlagClear]', head.slice(0, 24), '-> registry', regAddr.slice(0, 24));
  return { ...res, registryAddr: regAddr };
}`],
    ],
  },
  {
    f: 'kaspa_payload.ts',
    marker: 'KV_FLAGS_TALLY',
    edits: [
      ["  const delistByTarget = new Map<string, any>();",
       `  // KV_FLAGS_TALLY: every wallet counts flags itself - no server, no single judge.
  const KV_FLAG_THRESHOLD = 3;
  const _kvFlagMod = '${MOD}';
  const _kvPublishers = new Set<string>();
  for (const a of anns) { const r: any = a.record; if (r && r.k === 'registry' && r.o && (r._bv || verifyRecord(r))) _kvPublishers.add(String(r.o)); }
  const _kvClearT = new Map<string, number>();
  for (const a of anns) {
    const r: any = a.record;
    if (r && r.k === 'flagclear' && r.o === _kvFlagMod && r.d && r.d.head && verifyRecord(r)) {
      const h = String(r.d.head); _kvClearT.set(h, Math.max(_kvClearT.get(h) || 0, r.t || 0));
    }
  }
  const _kvFlagsBy = new Map<string, Map<string, string>>(); // head -> flagger -> reason
  for (const a of anns) {
    const r: any = a.record;
    if (!r || r.k !== 'flag' || !r.d || !r.d.head || !r.o) continue;
    const h = String(r.d.head);
    if ((r.t || 0) <= (_kvClearT.get(h) || 0)) continue;   // cleared by mod
    if (!_kvPublishers.has(String(r.o))) continue;          // reputation gate: flagger must be a listed publisher
    if (!verifyRecord(r)) continue;
    let m = _kvFlagsBy.get(h); if (!m) { m = new Map(); _kvFlagsBy.set(h, m); }
    m.set(String(r.o), String(r.d.reason || ''));
  }
  const delistByTarget = new Map<string, any>();`],
      ["    const _dl = delistByTarget.get(String(record.d.storeAddress));\n    if (_dl && (_dl.o === owner || _dl.o === KV_MOD_PUBKEY) && (_dl.t || 0) > (record.t || 0)) continue;",
       `    const _dl = delistByTarget.get(String(record.d.storeAddress));
    if (_dl && (_dl.o === owner || _dl.o === KV_MOD_PUBKEY) && (_dl.t || 0) > (record.t || 0)) continue;
    const _kvFl = _kvFlagsBy.get(String(record.d.storeAddress));
    if (_kvFl) {
      _kvFl.delete(String(owner)); // owner's own flags never count
      if (_kvFl.size >= KV_FLAG_THRESHOLD) { console.warn('[Directory] hidden by', _kvFl.size, 'flags:', String(record.d.name || '').slice(0, 24), Array.from(_kvFl.values()).join(',')); continue; }
      if (_kvFl.size) console.log('[Directory] flags', _kvFl.size + '/' + KV_FLAG_THRESHOLD, String(record.d.name || '').slice(0, 24));
    }`],
    ],
  },
  {
    f: 'VillageMailbox.tsx',
    marker: 'KV_FLAGS_UI',
    edits: [
      ["  const runDelistOwner = async (entry: any, kind: string) => {",
       `  // KV_FLAGS_UI: community flag (+ mod clear)
  const runFlag = async (entry: any, kind: string) => {
    try {
      const ps = require('./proposal_share');
      const SS = require('expo-secure-store');
      const sender = (await SS.getItemAsync('kv_kaspa_address')) || (await SS.getItemAsync('kaspa_address'));
      const priv = await ps._kvResolvePrivHex();
      if (!sender || !priv) throw new Error('wallet identity unavailable');
      const { bytesToHex, hexToBytes } = require('@noble/hashes/utils');
      const { secp256k1 } = require('@noble/curves/secp256k1');
      const pub = bytesToHex(secp256k1.getPublicKey(hexToBytes(priv), true));
      const head = String(entry.arweaveTx || entry.id);
      if (entry.ownerPubkey && String(entry.ownerPubkey) === pub) { Alert.alert('Your listing', 'You cannot flag your own listing.'); return; }
      const keys = { privateKeyHex: priv, pubkeyHex: pub, address: sender, network: 'testnet-10' as any };
      const send = async (reason: string) => {
        try {
          const { flagListing } = require('./payload_publish');
          const r: any = await flagListing(keys, head, reason, kind);
          if (r && r.success === false) throw new Error(String(r.error || 'send failed'));
          Alert.alert('Flag posted', 'Your flag counts if you have a listing of your own. 3 flags from different publishers hide this listing in every wallet.');
        } catch (e: any) { Alert.alert('Flag failed', String((e && e.message) || e)); }
      };
      const btns: any[] = [
        { text: 'Scam / fraud', onPress: () => send('fraud') },
        { text: 'Prohibited / illegal', onPress: () => send('prohibited') },
        { text: 'Spam / fake', onPress: () => send('spam') },
      ];
      if (pub === '${MOD}') btns.push({ text: 'Mod: clear all flags', onPress: async () => {
        try {
          const { clearFlags } = require('./payload_publish');
          const r: any = await clearFlags(keys, head, kind);
          if (r && r.success === false) throw new Error(String(r.error || 'send failed'));
          Alert.alert('Flags cleared', 'Older flags on this listing no longer count.');
        } catch (e: any) { Alert.alert('Clear failed', String((e && e.message) || e)); }
      } });
      btns.push({ text: 'Cancel', style: 'cancel' });
      Alert.alert('Flag this listing? (~1 KAS)', 'Flags are public, signed by your key, and counted by every wallet.', btns);
    } catch (e: any) { Alert.alert('Flag failed', String((e && e.message) || e)); }
  };
  const runDelistOwner = async (entry: any, kind: string) => {`],
      ["                    {/* KV_DELIST_OWNER */}\n",
       `                    {/* KV_FLAG_BTN */}
                    <TouchableOpacity onPress={() => runFlag(storeView.entry as any, 'store')} style={{ marginTop: rs.s(8), borderWidth: 1, borderColor: '#d97706', borderRadius: rs.s(10), paddingVertical: rs.s(10), alignItems: 'center' }}>
                      <Text style={{ color: '#d97706', fontSize: rs.font(11), fontWeight: 'bold' }}>Flag this listing (~1 KAS)</Text>
                    </TouchableOpacity>
                    {/* KV_DELIST_OWNER */}
`],
      ["                    {/* KV_DELIST_OWNER store */}\n",
       `                    {/* KV_FLAG_BTN store */}
                    <TouchableOpacity onPress={() => runFlag(storeView.entry as any, 'store')} style={{ marginTop: rs.s(6), borderWidth: 1, borderColor: '#d97706', borderRadius: rs.s(10), paddingVertical: rs.s(7), alignItems: 'center' }}>
                      <Text style={{ color: '#d97706', fontSize: rs.font(10), fontWeight: 'bold' }}>Flag this listing (~1 KAS)</Text>
                    </TouchableOpacity>
                    {/* KV_DELIST_OWNER store */}
`],
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
  for (let i = 0; i < j.edits.length; i++) { const c = s.split(j.edits[i][0]).length - 1; if (c !== 1) { console.error(j.f + ' ANCHOR ' + (i + 1) + ' count = ' + c + ' - expected 1.'); ok = false; } }
  staged.push({ ...j, s, CRLF });
}
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const j of staged) {
  let s = j.s;
  for (const [a, b] of j.edits) s = s.split(a).join(b);
  fs.writeFileSync(j.f, j.CRLF ? s.replace(/\n/g, '\r\n') : s);
  console.log(j.f + ': patched');
}
console.log('DONE - community flags live (3 distinct listed publishers = hidden; mod can clear).');
