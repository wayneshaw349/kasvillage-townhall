// wire_board_grants.cjs — #5 Contact dev + board grants (Apple-safe sales, on-chain proof).
//  payload_publish.ts : grantAccess(dev, toPub, game, item, txid) -> {k:'grant'} on the game
//                       registry (0.1 KAS), signed by the game's publisher key.
//  kaspa_payload.ts   : kvVerifyPayment(txid, payTo) - checks the payment tx paid the dev's
//                       SIGNED address; boot-loads saved grants into globalThis.__kvGrantsAll.
//  VillageMailbox.tsx : games lane reads grants for THIS wallet, only if signed by that game's
//                       publisher; verifies the payment txid; saves proofs on the phone
//                       (kv_purchase_proofs - survives pruning). Card gets "Contact developer"
//                       (copies a message with your KasVillage ID, warns: pay only the card's address).
//  OnChainPageView.tsx: games receive window.KV_GRANTS = { gameId: ['board2', ...] }.
//  Workspace.tsx      : per-game GRANT button (buyer ID + board + payment txid) and
//                       MY CONTACT button; contact handle rides in the published quad.
const fs = require('fs');
const NOBLE = "const { bytesToHex, hexToBytes } = require('@noble/hashes/utils'); const { secp256k1 } = require('@noble/curves/secp256k1');";

const jobs = [
  { f: 'payload_publish.ts', marker: 'KV_GRANT_SEND', append: `

// KV_GRANT_SEND: board/item grant, signed by the game's publisher key (0.1 KAS)
export async function grantAccess(dev: OwnerKeys, toPub: string, game: string, item: string, txid: string) {
  const rec = signRecord({ v: 1, k: 'grant', t: Date.now(), o: dev.pubkeyHex, d: { game, item, to: toPub, txid } } as any, dev.privateKeyHex);
  const regAddr = registryAddress('game', dev.network);
  const res = await sendKaspaViaRest({
    senderAddress: dev.address,
    recipientAddress: regAddr,
    amountSompi: REPOST_SOMPI,
    privateKeyHex: dev.privateKeyHex,
    network: dev.network,
    payload: buildPayloadHex(rec),
  });
  console.log('[Grant]', game, item, '->', toPub.slice(0, 12), 'txid', String(txid).slice(0, 10));
  return { ...res, registryAddr: regAddr };
}
` },
  { f: 'kaspa_payload.ts', marker: 'KV_GRANT_VERIFY', append: `

// KV_GRANT_VERIFY: did this tx pay the dev's SIGNED address? (check soon after grant - pruning)
export async function kvVerifyPayment(txid: string, payTo: string, network: string = 'testnet-10'): Promise<{ ok: boolean; amountKas: number; found: boolean }> {
  try {
    if (!/^[0-9a-f]{64}$/i.test(String(txid || ''))) return { ok: false, amountKas: 0, found: false };
    const api = String(network).indexOf('testnet') >= 0 ? 'https://api-tn10.kaspa.org' : 'https://api.kaspa.org';
    const r = await fetch(api + '/transactions/' + txid);
    if (!r.ok) return { ok: false, amountKas: 0, found: false };
    const j: any = await r.json();
    let amt = 0;
    for (const o of (j.outputs || [])) if (payTo && String(o.script_public_key_address) === String(payTo)) amt += Number(o.amount || 0);
    return { ok: amt > 0, amountKas: amt / 1e8, found: true };
  } catch { return { ok: false, amountKas: 0, found: false }; }
}
// KV_GRANTS_BOOT: saved grants are available before the Mailbox ever loads
try { require('@react-native-async-storage/async-storage').default.getItem('kv_grants').then((v: any) => { try { if (v) (globalThis as any).__kvGrantsAll = JSON.parse(v); } catch {} }); } catch {}
` },
  { f: 'OnChainPageView.tsx', marker: 'KV_GRANTS', edits: [
    ["injectedJavaScriptBeforeContentLoaded={CONSOLE_TAP + BRIDGE + KV_WNET_INJECT + (props.game ? KV_AUDIO_KEEP : '')}",
     "injectedJavaScriptBeforeContentLoaded={CONSOLE_TAP + BRIDGE + KV_WNET_INJECT + (props.game ? KV_AUDIO_KEEP : '') + (props.game ? ('try{window.KV_GRANTS=' + JSON.stringify((globalThis as any).__kvGrantsAll || {}) + ';}catch(e){};') : '') /* KV_GRANTS */}"],
  ] },
  { f: 'VillageMailbox.tsx', marker: 'KV_GRANTS_LANE', edits: [
    // parse grants (signature-checked)
    ["            if (r && r.k === 'flag' && r.d && r.d.head) return { flag: true,",
     "            if (r && r.k === 'grant' && r.d && r.d.game && r.d.to) { try { if (typeof kp.verifyRecord === 'function' && !kp.verifyRecord(r)) return null; } catch { return null; } return { grant: true, rec: r }; } // KV_GRANTS_LANE\n            if (r && r.k === 'flag' && r.d && r.d.head) return { flag: true,"],
    // collect
    ["            if (it.flag) { let m = flagsByHead.get(it.head);",
     "            if (it.grant) { grantRecs.push(it.rec); return; }\n            if (it.flag) { let m = flagsByHead.get(it.head);"],
    ["          const flagsByHead = new Map<string, Map<string, string>>(); // head -> flagger -> reason\n",
     "          const flagsByHead = new Map<string, Map<string, string>>(); // head -> flagger -> reason\n          const grantRecs: any[] = [];\n"],
    // process before the flag tally
    ["          // KV_GAME_FLAGS tally:",
     `          // KV_GRANTS: board grants for THIS wallet, only if signed by that game's publisher
          try {
            const _g: any = globalThis as any;
            if (!_g.__kvMyPub) { try { const ps = require('./proposal_share'); const pk = await ps._kvResolvePrivHex(); ${NOBLE} if (pk) _g.__kvMyPub = bytesToHex(secp256k1.getPublicKey(hexToBytes(pk), true)); } catch {} }
            const me = _g.__kvMyPub;
            if (me && grantRecs.length) {
              const pubOf = new Map<string, string>(); const payTo = new Map<string, string>();
              for (const it of byHead.values()) { if (it.quad && it.quad.game) { pubOf.set(String(it.quad.game), String(it.o)); if (it.quad.tip_addr) payTo.set(String(it.quad.game), String(it.quad.tip_addr)); } }
              const all: any = _g.__kvGrantsAll || {};
              const proofs: any[] = JSON.parse((await AS.getItem('kv_purchase_proofs')) || '[]');
              let changed = false;
              for (const r of grantRecs) {
                const d = r.d || {}; const game = String(d.game || ''); const item = String(d.item || '');
                if (String(d.to) !== me || !game || !item || pubOf.get(game) !== String(r.o)) continue;
                const list = all[game] || (all[game] = []);
                if (list.indexOf(item) < 0) { list.push(item); changed = true; }
                if (!proofs.some((p: any) => p.game === game && p.item === item && p.txid === String(d.txid || ''))) {
                  let v: any = { ok: false, amountKas: 0 };
                  try { v = await kp.kvVerifyPayment(String(d.txid || ''), payTo.get(game) || '', 'testnet-10'); } catch {}
                  proofs.push({ game, item, txid: String(d.txid || ''), dev: String(r.o), verified: !!v.ok, amountKas: v.amountKas || 0, grant: r, savedAt: Date.now() });
                  changed = true;
                  console.log('[Grants] ' + game + '/' + item + ' granted' + (v.ok ? ' - payment VERIFIED ' + v.amountKas + ' KAS' : ' - payment not verified'));
                }
              }
              if (changed) { _g.__kvGrantsAll = all; await AS.setItem('kv_grants', JSON.stringify(all)); await AS.setItem('kv_purchase_proofs', JSON.stringify(proofs)); }
            }
          } catch (e) { console.warn('[Grants]', e); }
          // KV_GAME_FLAGS tally:`],
    // Contact developer on the card
    [">Flag (0.1 KAS)</Text>\n        </TouchableOpacity>\n      ) : null}\n",
     `>Flag (0.1 KAS)</Text>
        </TouchableOpacity>
      ) : null}
      {item.quad && item.quad.contact ? (
        <TouchableOpacity onPress={async () => { // KV_DEV_CONTACT
          try {
            const g: any = globalThis as any; let me = g.__kvMyPub || '';
            if (!me) { try { const ps = require('./proposal_share'); const pk = await ps._kvResolvePrivHex(); ${NOBLE} me = bytesToHex(secp256k1.getPublicKey(hexToBytes(pk), true)); g.__kvMyPub = me; } catch {} }
            const msg = 'Hi! I play ' + (item.name || item.quad.game) + ' on KasVillage and would like the next board. My KasVillage ID: ' + me;
            try { await require('expo-clipboard').setStringAsync(msg); } catch { try { require('react-native').Clipboard.setString(msg); } catch {} }
            const c = String(item.quad.contact).trim(); const RN = require('react-native');
            let url = c;
            if (/^[^@\\s]+@[^@\\s]+\\.[a-z]{2,}$/i.test(c)) url = 'mailto:' + c + '?subject=' + encodeURIComponent('KasVillage board') + '&body=' + encodeURIComponent(msg);
            else if (/^@?[A-Za-z0-9_]{3,}$/.test(c)) url = 'https://t.me/' + c.replace(/^@/, '');
            else if (!/^https?:\\/\\//i.test(c)) url = 'https://' + c;
            RN.Alert.alert('Contact developer', 'Your message with your KasVillage ID is copied - paste it in the chat.\\n\\nPay ONLY the address on this game card' + (item.quad.tip_addr ? ' (' + String(item.quad.tip_addr).slice(0, 20) + '\\u2026)' : '') + '. Never pay an address sent to you in a DM.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open chat', onPress: () => { RN.Linking.openURL(url).catch(() => {}); } },
            ]);
          } catch {}
        }} style={{ marginTop: 6, borderColor: '#0891b2', borderWidth: 1, borderRadius: 8, paddingVertical: 5, alignItems: 'center' }}>
          <Text style={{ color: '#0891b2', fontWeight: '700', fontSize: 11 }}>Contact developer</Text>
        </TouchableOpacity>
      ) : null}
`],
  ] },
  { f: 'Workspace.tsx', marker: 'KV_GRANT_UI', edits: [
    ["  const runDelist = async (gameId: string) => {",
     `  // KV_GRANT_UI: dev grants a board to a buyer (buyer ID + board + payment txid as proof)
  try { const _g: any = globalThis as any; if (!_g.__kvDevContactLoaded) { _g.__kvDevContactLoaded = 1; require('@react-native-async-storage/async-storage').default.getItem('kv_dev_contact').then((v: any) => { if (v) _g.__kvDevContact = v; }); } } catch {}
  const setMyContact = () => {
    const RN = require('react-native');
    if (!(RN.Alert as any).prompt) { Alert.alert('iOS only for now'); return; }
    (RN.Alert as any).prompt('My contact (for buyers)', 'Telegram @handle, email, or a link (ig.me/..., wa.me/...). Goes into your next ANNOUNCE so buyers can reach you.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Save', onPress: async (t: string) => { const v = String(t || '').trim(); (globalThis as any).__kvDevContact = v; try { await require('@react-native-async-storage/async-storage').default.setItem('kv_dev_contact', v); } catch {} Alert.alert('Saved', v ? 'Re-ANNOUNCE the game so the contact reaches the card.' : 'Contact cleared.'); } },
    ], 'plain-text', String((globalThis as any).__kvDevContact || ''));
  };
  const runGrant = (gameId: string) => {
    const RN = require('react-native');
    if (!(RN.Alert as any).prompt) { Alert.alert('iOS only for now'); return; }
    const ask = (title: string, msg: string, next: (v: string) => void) => (RN.Alert as any).prompt(title, msg, [{ text: 'Cancel', style: 'cancel' }, { text: 'Next', onPress: (t: string) => next(String(t || '').trim()) }], 'plain-text');
    ask('Grant - buyer ID', 'Paste the buyer\\'s KasVillage ID (from their message).', (to) => {
      to = to.toLowerCase().replace(/[^0-9a-f]/g, '');
      if (!/^0[23][0-9a-f]{64}$/.test(to)) { Alert.alert('Bad ID', 'A KasVillage ID is 66 hex characters starting with 02 or 03.'); return; }
      ask('Grant - board', 'Board / item name your game checks, e.g. board2', (item) => {
        if (!item) return;
        ask('Grant - payment txid', 'The buyer\\'s payment transaction id (proof it was paid).', (txid) => {
          txid = txid.toLowerCase().replace(/[^0-9a-f]/g, '');
          if (!/^[0-9a-f]{64}$/.test(txid)) { Alert.alert('Bad txid', 'A transaction id is 64 hex characters.'); return; }
          Alert.alert('Grant ' + item + '?', 'To ' + to.slice(0, 12) + '\\u2026 for ' + gameId + ' (0.1 KAS, signed by your key).', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Grant', onPress: async () => {
              try {
                const ps = require('./proposal_share'); const SS = require('expo-secure-store');
                const sender = (await SS.getItemAsync('kv_kaspa_address')) || (await SS.getItemAsync('kaspa_address'));
                const priv = await ps._kvResolvePrivHex();
                if (!sender || !priv) throw new Error('wallet identity unavailable');
                ${NOBLE}
                const pub = bytesToHex(secp256k1.getPublicKey(hexToBytes(priv), true));
                const { grantAccess } = require('./payload_publish');
                const r: any = await grantAccess({ privateKeyHex: priv, pubkeyHex: pub, address: sender, network: 'testnet-10' as any }, to, gameId, item, txid);
                if (r && r.success === false) throw new Error(String(r.error || 'send failed'));
                gadd('GRANTED ' + item + ' of ' + gameId + ' -> ' + to.slice(0, 12) + '\\u2026');
                Alert.alert('Granted', 'The buyer\\'s wallet unlocks ' + item + ' on its next Games refresh and saves the payment proof.');
              } catch (e: any) { Alert.alert('Grant failed', String((e && e.message) || e)); }
            } },
          ]);
        });
      });
    });
  };
  const runDelist = async (gameId: string) => {`],
  ], quad: true, btn: true },
];

let ok = true; const staged = [];
for (const j of jobs) {
  let s;
  try { s = fs.readFileSync(j.f, 'utf8'); } catch { console.error(j.f + ' not found'); ok = false; continue; }
  const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
  if (s.includes(j.marker)) { console.log(j.f + ': already patched - skipping'); continue; }
  for (const [a] of (j.edits || [])) { const c = s.split(a).length - 1; if (c !== 1) { console.error(j.f + ' ANCHOR count ' + c + ' expected 1: ' + a.slice(0, 60).replace(/\n/g, ' ')); ok = false; } }
  if (j.quad) { const c = s.split('...(tipOn ? { tip_addr: myAddr } : {})').length - 1; if (c < 1) { console.error(j.f + ' quad tip_addr anchor not found'); ok = false; } j.quadCount = c; }
  if (j.btn) { const m = s.match(/=> runDelist\(([^)]+)\)/g) || []; if (m.length !== 1) { console.error(j.f + ' DELIST button anchor count ' + m.length + ' expected 1'); ok = false; } }
  staged.push({ ...j, s, CRLF });
}
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const j of staged) {
  let s = j.s;
  for (const [a, b] of (j.edits || [])) s = s.split(a).join(b);
  if (j.append) s = s.replace(/\s*$/, '') + j.append;
  if (j.quad) s = s.split('...(tipOn ? { tip_addr: myAddr } : {})').join("...(tipOn ? { tip_addr: myAddr } : {}), ...((globalThis as any).__kvDevContact ? { contact: (globalThis as any).__kvDevContact } : {})");
  if (j.btn) {
    const m = s.match(/=> runDelist\(([^)]+)\)/); const arg = m[1];
    const at = s.indexOf(m[0]); const open = s.lastIndexOf('<TouchableOpacity', at);
    const btns = `<TouchableOpacity onPress={() => runGrant(${arg})} style={{ borderWidth: 1, borderColor: '#0891b2', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, marginRight: 6, alignItems: 'center' }}><Text style={{ color: '#0891b2', fontWeight: '700', fontSize: 11 }}>GRANT</Text></TouchableOpacity>
                <TouchableOpacity onPress={setMyContact} style={{ borderWidth: 1, borderColor: '#64748b', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, marginRight: 6, alignItems: 'center' }}><Text style={{ color: '#64748b', fontWeight: '700', fontSize: 11 }}>MY CONTACT</Text></TouchableOpacity>
                `;
    s = s.slice(0, open) + btns + s.slice(open);
  }
  fs.writeFileSync(j.f, j.CRLF ? s.replace(/\n/g, '\r\n') : s);
  console.log(j.f + ': patched' + (j.quad ? ' (contact added to ' + j.quadCount + ' quad site(s))' : ''));
}
console.log('DONE - board grants live: Contact developer, GRANT (with payment proof), window.KV_GRANTS for games.');
