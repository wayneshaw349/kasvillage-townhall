// wire_mod_sticky.cjs — moderator delists STICK to the store address.
// Before: the owner could undo a mod removal by simply announcing again (newer t won).
// Now:    a mod (cold-key) delist hides that store address no matter how many re-announces
//         follow. Owner self-delists still work the old way (owner can re-list).
// Lifting: only the cold key, via {k:'undelist'} - Workspace "LIFT MOD DELIST"
//          (store address + registry + cold key, signs once, forgets the key).
// Mod actions are cached on the device, so they also survive pruning.
const fs = require('fs');
const AS = "require('@react-native-async-storage/async-storage').default";

const STICKY = `  // KV_MOD_STICKY: latest cold-key action per store address (delist / undelist), cached on device
  const _kvModHeads = new Set<string>();
  try {
    const _mk = 'kv_mod_actions_' + String(registryAddress).slice(-16);
    const _act: Record<string, { t: number; del: boolean }> = JSON.parse((await ${AS}.getItem(_mk)) || '{}');
    for (const a of anns) {
      const r: any = a.record;
      if (!r || r.o !== KV_MOD_PUBKEY || (r.k !== 'delist' && r.k !== 'undelist') || !r.d || !r.d.head || !verifyRecord(r)) continue;
      const h = String(r.d.head); const cur = _act[h];
      if (!cur || (r.t || 0) > cur.t) _act[h] = { t: r.t || 0, del: r.k === 'delist' };
    }
    await ${AS}.setItem(_mk, JSON.stringify(_act));
    for (const h of Object.keys(_act)) if (_act[h].del) _kvModHeads.add(h);
  } catch {}
`;

const LIFT_FN = `

// KV_MOD_LIFT: generic mod record (undelist) signed by the cold key; dust paid by the wallet
export async function postModRecord(owner: OwnerKeys, k: string, head: string, kind: string, signer: { privateKeyHex: string; pubkeyHex: string }, extra?: Record<string, any>) {
  const rec = signRecord({ v: 1, k, t: Date.now(), o: signer.pubkeyHex, d: { head, ...(extra || {}) } } as any, signer.privateKeyHex);
  const regAddr = registryAddress(kind, owner.network);
  const res = await sendKaspaViaRest({
    senderAddress: owner.address, recipientAddress: regAddr, amountSompi: ANNOUNCE_SOMPI,
    privateKeyHex: owner.privateKeyHex, network: owner.network, payload: buildPayloadHex(rec),
  });
  console.log('[ModRecord]', k, head.slice(0, 24), '-> registry', regAddr.slice(0, 24));
  return { ...res, registryAddr: regAddr };
}
`;

const LIFT_UI = `  // KV_MOD_LIFT_UI: lift a moderator delist (cold key)
  const liftModDelist = () => {
    const kvP = require('./kv_prompt').kvPrompt;
    kvP('Lift mod delist - address / head', 'Store address (kaspatest:...) or, for a game, its head hash.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Next', onPress: (head: string) => {
      head = String(head || '').trim(); if (!/^kaspa(test)?:[a-z0-9]{40,}$/.test(head) && !/^[0-9a-f]{64}$/i.test(head)) { Alert.alert('Bad target', 'Paste the full store address or the 64-hex game head.'); return; }
      kvP('Registry', 'store (stores, services, academics), dapp, or game', [{ text: 'Next', onPress: (kind: string) => {
        kind = /game/i.test(String(kind || '')) ? 'game' : /dapp/i.test(String(kind || '')) ? 'dapp' : 'store';
        kvP('Cold mod key', 'Paste the moderator private key (64 hex). Used once, never stored.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Lift', onPress: async (t: string) => {
          try {
            const k = String(t || '').replace(/[^0-9a-fA-F]/g, '').toLowerCase();
            const mp = bytesToHex(secp256k1.getPublicKey(hexToBytes(k), true));
            const MOD = '__MODPUB__';
            if (mp !== MOD) { Alert.alert('Wrong key', 'That key does not match the moderation public key.'); return; }
            const { _kvResolvePrivHex } = require('./proposal_share');
            const priv = await _kvResolvePrivHex(); if (!priv || !myAddr) throw new Error('wallet keys unavailable');
            const pub = bytesToHex(secp256k1.getPublicKey(hexToBytes(priv), true));
            const { postModRecord } = require('./payload_publish');
            const r: any = await postModRecord({ privateKeyHex: priv, pubkeyHex: pub, address: myAddr, network: 'testnet-10' as any }, 'undelist', head, kind, { privateKeyHex: k, pubkeyHex: mp });
            if (r && r.success === false) throw new Error(String(r.error || 'send failed'));
            Alert.alert('Lifted', 'Undelist posted. The listing returns in every wallet on its next refresh.');
          } catch (e: any) { Alert.alert('Lift failed', String((e && e.message) || e)); }
        } }], 'secure-text');
      } }], 'plain-text', 'store');
    } }], 'plain-text');
  };
`;

let MODPUB = '';
try { MODPUB = fs.readFileSync('modkey.pub.txt', 'utf8').trim(); } catch {}
if (!/^0[23][0-9a-f]{64}$/.test(MODPUB)) { console.error('modkey.pub.txt missing - run make_mod_key.cjs / wire_cold_mod.cjs first'); process.exit(1); }

const jobs = [
  { f: 'kaspa_payload.ts', marker: 'KV_MOD_STICKY', edits: [
    ["  // KV_STORE_DELIST_CACHE: delists survive pruning on this device (re-verified every load)\n", STICKY + "  // KV_STORE_DELIST_CACHE: delists survive pruning on this device (re-verified every load)\n"],
    ["    const _dl = delistByTarget.get(String(record.d.storeAddress));\n",
     "    if (_kvModHeads.has(String(record.d.storeAddress))) continue; // KV_MOD_STICKY: cold-key removal sticks\n    const _dl = delistByTarget.get(String(record.d.storeAddress));\n"],
  ] },
  { f: 'payload_publish.ts', marker: 'KV_MOD_LIFT', append: LIFT_FN, edits: [] },
  { f: 'Workspace.tsx', marker: 'KV_MOD_LIFT_UI', edits: [
    ["  // KV_SALES_EXPORT: signed sales report for publishers / studios\n", LIFT_UI.replace('__MODPUB__', MODPUB) + "  // KV_SALES_EXPORT: signed sales report for publishers / studios\n"],
    ["<TouchableOpacity onPress={exportSales}",
     "<TouchableOpacity onPress={liftModDelist} style={{ borderWidth: 1, borderColor: '#b91c1c', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, marginRight: 6, alignItems: 'center' }}><Text style={{ color: '#b91c1c', fontWeight: '700', fontSize: 11 }}>LIFT MOD DELIST</Text></TouchableOpacity>\n                <TouchableOpacity onPress={exportSales}"],
  ] },
  { f: 'VillageMailbox.tsx', marker: 'KV_MOD_STICKY_GAMES', edits: [
    ["            if (r && (r.k === 'delist' || r.k === 'flag') && typeof kp.verifyRecord === 'function')",
     "            if (r && r.k === 'undelist' && r.d && r.d.head) { try { if (typeof kp.verifyRecord === 'function' && !kp.verifyRecord(r)) return null; } catch { return null; } return { undelist: true, head: String(r.d.head), t: r.t || 0, o: r.o || '' }; } // KV_MOD_STICKY_GAMES\n            if (r && (r.k === 'delist' || r.k === 'flag') && typeof kp.verifyRecord === 'function')"],
    ["          const grantRecs: any[] = [];\n",
     "          const grantRecs: any[] = [];\n          const modHeadsG = new Map<string, number>(); const modLiftG = new Map<string, number>();\n"],
    ["            if (it.delist) { const p = delistByHead.get(it.head);",
     "            if (it.undelist) { if (it.o === KV_MOD_PUBKEY) modLiftG.set(it.head, Math.max(modLiftG.get(it.head) || 0, it.t)); return; }\n            if (it.delist && it.o === KV_MOD_PUBKEY) modHeadsG.set(it.head, Math.max(modHeadsG.get(it.head) || 0, it.t));\n            if (it.delist) { const p = delistByHead.get(it.head);"],
    ["          const items = Array.from(byHead.values()).filter((it: any) => {\n            const d = delistByHead.get(it.quad.head);",
     "          // KV_MOD_STICKY games: cold-key delists stick to the head; only a cold-key undelist lifts\n          try {\n            const _ga: any = JSON.parse((await AS.getItem('kv_game_mod_actions')) || '{}');\n            for (const [h, t] of modHeadsG) if (!_ga[h] || t > _ga[h].t) _ga[h] = { t, del: true };\n            for (const [h, t] of modLiftG) if (!_ga[h] || t > _ga[h].t) _ga[h] = { t, del: false };\n            await AS.setItem('kv_game_mod_actions', JSON.stringify(_ga));\n            for (const h of Object.keys(_ga)) if (_ga[h].del && byHead.has(h)) { byHead.delete(h); console.log('[GamesLane] mod-removed (sticky) ' + h.slice(0, 8)); }\n          } catch {}\n          const items = Array.from(byHead.values()).filter((it: any) => {\n            const d = delistByHead.get(it.quad.head);"],
  ] },
];
let ok = true; const staged = [];
for (const j of jobs) {
  let s = fs.readFileSync(j.f, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
  if (s.includes(j.marker)) { console.log(j.f + ': already patched - skipping'); continue; }
  for (const [a] of j.edits) { const c = s.split(a).length - 1; if (c !== 1) { console.error(j.f + ' ANCHOR count ' + c + ' expected 1: ' + a.slice(0, 60).replace(/\n/g, ' ') + ' (run wire_evidence_seal first)'); ok = false; } }
  staged.push({ ...j, s, CRLF });
}
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const j of staged) {
  let s = j.s;
  for (const [a, b] of j.edits) s = s.split(a).join(b);
  if (j.append) s = s.replace(/\s*$/, '') + j.append;
  fs.writeFileSync(j.f, j.CRLF ? s.replace(/\n/g, '\r\n') : s);
  console.log(j.f + ': patched');
}
console.log('DONE - mod delists stick to the store address; only the cold key can lift them.');
