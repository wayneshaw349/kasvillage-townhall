// wire_mod_confirm_note.cjs — guard rails for a no-arbitration moderator.
// 1. CONFIRM: before the cold key signs a delist, a screen shows store name, address, owner and
//    reason; you must type DELIST. Mod delists now also record the owner's pubkey (public anyway).
// 2. ERROR NOTE: Workspace "MOD: ERROR NOTE" posts a cold-key {k:'modnote'} - "removed in error".
//    It does NOT reinstate the store (still final); the owner's alert says the moderator publicly
//    acknowledged the mistake, so their record isn't stained. You correct your own act, never judge.
// Also fixes: sticky mod removals now still trigger the owner's "removed by the moderator" alert.
const fs = require('fs');
const AS = "require('@react-native-async-storage/async-storage').default";
let MODPUB = ''; try { MODPUB = fs.readFileSync('modkey.pub.txt', 'utf8').trim(); } catch {}
if (!/^0[23][0-9a-f]{64}$/.test(MODPUB)) { console.error('modkey.pub.txt missing'); process.exit(1); }

const NOTE_UI = `  // KV_MOD_NOTE_UI: cold-key "removed in error" note (does not reinstate)
  const modErrorNote = () => {
    const kvP = require('./kv_prompt').kvPrompt;
    kvP('Moderator error note - target', 'Store address (kaspatest:...) or game head of the listing you removed by mistake.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Next', onPress: (head: string) => {
      head = String(head || '').trim(); if (!/^kaspa(test)?:[a-z0-9]{40,}$/.test(head) && !/^[0-9a-f]{64}$/i.test(head)) { Alert.alert('Bad target', 'Paste the full store address or the 64-hex game head.'); return; }
      setTimeout(() => kvP('Registry', 'store (stores, services, academics), dapp, or game', [{ text: 'Next', onPress: (kind: string) => {
        kind = /game/i.test(String(kind || '')) ? 'game' : /dapp/i.test(String(kind || '')) ? 'dapp' : 'store';
        setTimeout(() => kvP('Cold mod key', 'The removal stays final. This only publishes that it was a moderator error. Key used once, never stored.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Post note', onPress: async (t: string) => {
          try {
            const k = String(t || '').replace(/[^0-9a-fA-F]/g, '').toLowerCase();
            const mp = bytesToHex(secp256k1.getPublicKey(hexToBytes(k), true));
            if (mp !== '${MODPUB}') { Alert.alert('Wrong key', 'That key does not match the moderation public key.'); return; }
            const { _kvResolvePrivHex } = require('./proposal_share');
            const priv = await _kvResolvePrivHex(); if (!priv || !myAddr) throw new Error('wallet keys unavailable');
            const pub = bytesToHex(secp256k1.getPublicKey(hexToBytes(priv), true));
            const { postModRecord } = require('./payload_publish');
            const r: any = await postModRecord({ privateKeyHex: priv, pubkeyHex: pub, address: myAddr, network: 'testnet-10' as any }, 'modnote', head, kind, { privateKeyHex: k, pubkeyHex: mp }, { note: 'removed in error' });
            if (r && r.success === false) throw new Error(String(r.error || 'send failed'));
            Alert.alert('Error note posted', 'The removal stays final. The owner is told it was a moderator error.');
          } catch (e: any) { Alert.alert('Note failed', String((e && e.message) || e)); }
        } }], 'secure-text'), 450);
      } }], 'plain-text', 'store'), 450);
    } }], 'plain-text');
  };
`;

const jobs = [
  { f: 'VillageMailbox.tsx', marker: 'KV_MOD_CONFIRM', edits: [
    ["        const _fin = async (reason: string, note: string) => {",
     `        const _fin = (reason: string, note: string) => { // KV_MOD_CONFIRM: type DELIST before the cold key signs
          setTimeout(() => require('./kv_prompt').kvPrompt('Confirm moderator delist',
            'Store: ' + String(entry.title || entry.name || '(untitled)') + '\\nAddress: ' + _head + '\\nOwner: ' + String(entry.ownerPubkey || '?').slice(0, 20) + '\\u2026\\nReason: ' + reason + '\\n\\nFINAL for this address - it cannot be undone. Type DELIST to confirm.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Confirm', style: 'destructive', onPress: (t: string) => { if (String(t || '').trim().toUpperCase() !== 'DELIST') { Alert.alert('Not confirmed', 'Nothing was posted.'); return; } setTimeout(() => _finGo(reason, note), 400); } },
          ], 'plain-text'), 450);
        };
        const _finGo = async (reason: string, note: string) => {`],
    ["{ reason, evidenceHash, mod: 1 }, { privateKeyHex: _mPriv, pubkeyHex: _mPub });",
     "{ reason, evidenceHash, mod: 1, owner: String(entry.ownerPubkey || '') }, { privateKeyHex: _mPriv, pubkeyHex: _mPub });"],
  ] },
  { f: 'kaspa_payload.ts', marker: 'KV_MOD_NOTE', edits: [
    ["  // KV_STORE_DELIST_CACHE: delists survive pruning on this device (re-verified every load)\n",
     `  // KV_MOD_NOTE: cold-key "removed in error" acknowledgments (never reinstate), cached on device
  const _kvModNotes = new Map<string, string>();
  try {
    const _nk = 'kv_mod_notes_' + String(registryAddress).slice(-16);
    const _nn: Record<string, string> = JSON.parse((await ${AS}.getItem(_nk)) || '{}');
    for (const a of anns) { const r: any = a.record; if (r && r.k === 'modnote' && r.o === KV_MOD_PUBKEY && r.d && r.d.head && verifyRecord(r)) _nn[String(r.d.head)] = String(r.d.note || 'removed in error'); }
    await ${AS}.setItem(_nk, JSON.stringify(_nn));
    for (const h of Object.keys(_nn)) _kvModNotes.set(h, _nn[h]);
  } catch {}
  // KV_STORE_DELIST_CACHE: delists survive pruning on this device (re-verified every load)
`],
    ["    if (_kvModHeads.has(String(record.d.storeAddress))) continue; // KV_MOD_STICKY: cold-key removal sticks\n",
     `    if (_kvModHeads.has(String(record.d.storeAddress))) { // KV_MOD_STICKY: cold-key removal sticks (owner still told why)
      try { const _md: any = delistByTarget.get(String(record.d.storeAddress)); const _g: any = globalThis as any; if (!_g.__kvFlagInfo) _g.__kvFlagInfo = new Map(); _g.__kvFlagInfo.set(String(record.d.storeAddress), { n: 0, reasons: [], owner: String(owner), name: String(record.d.name || ''), hidden: true, mod: true, modReason: String((_md && _md.o === KV_MOD_PUBKEY && _md.d && _md.d.reason) || 'moderator decision'), modNote: _kvModNotes.get(String(record.d.storeAddress)) || '' }); } catch {}
      continue;
    }
`],
  ] },
  { f: 'mailbox_kaspa_api.ts', marker: 'KV_MOD_NOTE_WARN', edits: [
    ["          const key = fi.n + (fi.hidden ? ':h' : '') + (fi.mod ? ':m' : ''); // KV_MOD_OWNER_WARN",
     "          const key = fi.n + (fi.hidden ? ':h' : '') + (fi.mod ? ':m' : '') + (fi.modNote ? ':e' : ''); // KV_MOD_OWNER_WARN KV_MOD_NOTE_WARN"],
    ["          msgs.push(fi.mod\n",
     "          msgs.push(fi.mod && fi.modNote\n            ? '\"' + fi.name + '\" was removed by the moderator - and the moderator has publicly acknowledged it was an ERROR. The removal is final for that store, so open a new store; your record shows the error was not yours.'\n            : fi.mod\n"],
  ] },
  { f: 'Workspace.tsx', marker: 'KV_MOD_NOTE_UI', edits: [
    ["  // KV_SALES_EXPORT: signed sales report for publishers / studios\n", NOTE_UI + "  // KV_SALES_EXPORT: signed sales report for publishers / studios\n"],
    ["<TouchableOpacity onPress={exportSales}",
     "<TouchableOpacity onPress={modErrorNote} style={{ borderWidth: 1, borderColor: '#b91c1c', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, marginRight: 6, alignItems: 'center' }}><Text style={{ color: '#b91c1c', fontWeight: '700', fontSize: 11 }}>MOD: ERROR NOTE</Text></TouchableOpacity>\n                <TouchableOpacity onPress={exportSales}"],
  ] },
];
let ok = true; const staged = [];
for (const j of jobs) {
  let s = fs.readFileSync(j.f, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
  if (s.includes(j.marker)) { console.log(j.f + ': already patched - skipping'); continue; }
  for (const [a] of j.edits) { const c = s.split(a).length - 1; if (c !== 1) { console.error(j.f + ' ANCHOR count ' + c + ' expected 1: ' + a.slice(0, 60).replace(/\n/g, ' ')); ok = false; } }
  staged.push({ ...j, s, CRLF });
}
if (!ok) { console.error('Aborting - nothing written. (Run wire_mod_sticky.cjs + fix_no_lift.cjs first.)'); process.exit(1); }
for (const j of staged) { let s = j.s; for (const [a, b] of j.edits) s = s.split(a).join(b); fs.writeFileSync(j.f, j.CRLF ? s.replace(/\n/g, '\r\n') : s); console.log(j.f + ': patched'); }
console.log('DONE - type-DELIST confirm before mod delists; cold-key error notes (removal stays final).');
