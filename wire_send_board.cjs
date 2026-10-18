// wire_send_board.cjs — private board delivery ("send, don't unlock").
//  payload_publish.ts : sendBoard(dev, buyerPub, game, item, quad, proof) - 0.1 KAS rebate to the
//                       BUYER's own address carrying a signed {k:'grant', d:{game,item,to,quad,txid}}.
//                       Nothing goes to the public registry.
//  Workspace.tsx      : SEND BOARD (buyer pubkey + board name + optional txid/AGR_) builds the
//                       board's quad exactly like ANNOUNCE and delivers it privately.
//                       UNLISTED toggle: publish/announce runs stop before the public announce.
//                       Every send is logged to kv_sales_log (buyer pubkey hashed) for dev stats.
//  VillageMailbox.tsx : the Games lane scans THIS wallet's own address for grants signed to it,
//                       saves them (kv_received_boards - survives pruning) and lists them as
//                       "<game> · <board> (received)" cards with the normal DOWNLOAD.
//                       A grant naming a PUBLIC game from a different key is ignored (impostor).
const fs = require('fs');

const SEND_FN = `

// KV_SEND_BOARD: deliver a board privately - rebate dust to the buyer's address + render instructions
export async function sendBoard(dev: OwnerKeys, toPub: string, game: string, item: string, quad: any, proof: string = '') {
  const { deriveAddress } = require('./canonical_agreement_steps');
  const xo = String(toPub || '').replace(/^0[23]/, '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(xo)) throw new Error('bad buyer pubkey');
  const toAddr = deriveAddress(xo, dev.network as any);
  const rec = signRecord({ v: 1, k: 'grant', t: Date.now(), o: dev.pubkeyHex, d: { game, item, to: toPub, quad, txid: proof } } as any, dev.privateKeyHex);
  const res: any = await sendKaspaViaRest({
    senderAddress: dev.address,
    recipientAddress: toAddr,
    amountSompi: REPOST_SOMPI,
    privateKeyHex: dev.privateKeyHex,
    network: dev.network,
    payload: buildPayloadHex(rec),
  });
  console.log('[SendBoard]', game, item, '->', toAddr.slice(0, 24));
  return { ...res, toAddr };
}
`;

const GATE = `// KV_SEND_GATE: SEND BOARD delivers privately; UNLISTED skips the public announce
      if ((globalThis as any).__kvSendTo || (globalThis as any).__kvUnlisted) {
        const _st: any = (globalThis as any).__kvSendTo;
        (globalThis as any).__kvSendTo = null;
        if (_st) {
          gadd('SEND BOARD (private) -> ' + String(_st.toPub).slice(0, 12) + '\\u2026');
          const { sendBoard } = require('./payload_publish');
          const _sb: any = await sendBoard(owner, _st.toPub, gameId, _st.item, quad, _st.proof || '');
          if (_sb && _sb.success !== false) {
            gadd('board delivered to ' + String(_sb.toAddr).slice(0, 24) + '\\u2026 (0.1 KAS rebate + render instructions)');
            try {
              const _AS3 = require('@react-native-async-storage/async-storage').default;
              const _lg = JSON.parse((await _AS3.getItem('kv_sales_log')) || '[]');
              const _hx = (t: string) => bytesToHex(sha256(new TextEncoder().encode(t)));
              _lg.push({ game: gameId, item: _st.item, buyer: _hx(String(_st.toPub)), grantTx: String(_sb.txid || _sb.transactionId || ''), proof: _st.proof || '', head: quad.head, t: Date.now() });
              await _AS3.setItem('kv_sales_log', JSON.stringify(_lg));
              gadd('sales log: ' + _lg.length + ' deliveries total');
            } catch {}
          } else gadd('send failed: ' + String((_sb && _sb.error) || 'unknown'));
        } else gadd('UNLISTED - published but NOT announced. Use SEND BOARD to deliver it.');
        setGbusy(''); return;
      }
`;

const jobs = [
  { f: 'payload_publish.ts', marker: 'KV_SEND_BOARD', append: SEND_FN },
  { f: 'Workspace.tsx', marker: 'KV_SEND_BOARD_UI', edits: [
    ["  const runDelist = async (gameId: string) => {",
     `  // KV_SEND_BOARD_UI
  const [unlisted, setUnlisted] = useState(false);
  (globalThis as any).__kvUnlisted = unlisted;
  const runSendBoard = (gameId: string) => {
    const kvP = require('./kv_prompt').kvPrompt;
    const ask = (title: string, msg: string, next: (v: string) => void, def: string = '') => kvP(title, msg, [{ text: 'Cancel', style: 'cancel' }, { text: 'Next', onPress: (t: string) => next(String(t || '').trim()) }], 'plain-text', def);
    ask('Send board - buyer pubkey', 'The buyer\\'s pubkey from their message (66 hex, starts 02 or 03).', (to) => {
      to = to.toLowerCase().replace(/[^0-9a-f]/g, '');
      if (!/^0[23][0-9a-f]{64}$/.test(to)) { Alert.alert('Bad pubkey', 'A pubkey is 66 hex characters starting with 02 or 03.'); return; }
      ask('Send board - name', 'What the buyer sees, e.g. board2', (item) => {
        if (!item) return;
        ask('Send board - payment proof (optional)', 'txid or AGR_ agreement ID for your sales record. Leave blank for a free gift.', (proof) => {
          const pr = /^AGR_[A-Za-z0-9]+$/.test(proof) ? proof : proof.toLowerCase().replace(/[^0-9a-f]/g, '');
          Alert.alert('Send ' + item + '?', gameId + ' -> ' + to.slice(0, 12) + '\\u2026\\nPrivate delivery (0.1 KAS to the buyer). Not announced publicly.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Send', onPress: async () => { (globalThis as any).__kvSendTo = { toPub: to, item, proof: pr }; try { await runAnnounceOnly(gameId); } finally { (globalThis as any).__kvSendTo = null; } } },
          ]);
        });
      }, gameId);
    });
  };
  const runDelist = async (gameId: string) => {`],
    ["<TouchableOpacity onPress={setMyContact}",
     `<TouchableOpacity onPress={() => runSendBoard(${'${ARG}'})} style={{ borderWidth: 1, borderColor: '#16a34a', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, marginRight: 6, alignItems: 'center' }}><Text style={{ color: '#16a34a', fontWeight: '700', fontSize: 11 }}>SEND BOARD</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setUnlisted(!unlisted)} style={{ borderWidth: 1, borderColor: unlisted ? '#b45309' : '#a8a29e', backgroundColor: unlisted ? '#fef3c7' : 'transparent', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, marginRight: 6, alignItems: 'center' }}><Text style={{ color: unlisted ? '#b45309' : '#78716c', fontWeight: '700', fontSize: 11 }}>{unlisted ? 'UNLISTED \\u2713' : 'UNLISTED'}</Text></TouchableOpacity>
                <TouchableOpacity onPress={setMyContact}`],
  ], gate: true },
  { f: 'VillageMailbox.tsx', marker: 'KV_RECEIVED_BOARDS', edits: [
    ["          // KV_GAME_FLAGS tally:",
     `          // KV_RECEIVED_BOARDS: private boards sent to THIS wallet's own address
          try {
            const _g: any = globalThis as any; const me = _g.__kvMyPub;
            const _SS = require('expo-secure-store');
            const myAddr = (await _SS.getItemAsync('kv_kaspa_address')) || (await _SS.getItemAsync('kaspa_address'));
            const recv: any[] = JSON.parse((await AS.getItem('kv_received_boards')) || '[]');
            if (me && myAddr) {
              const fetchR2 = kp.fetchRecords || kp.fetchPayloadRecords || kp.fetchAddressRecords;
              const mine: any[] = (await fetchR2(myAddr, 'testnet-10', 50, 2)) || [];
              let ch = false;
              for (const row of mine) {
                const pa: any = parseAnn(row); if (!pa || !pa.grant) continue;
                const r: any = pa.rec; const d: any = r.d || {};
                if (String(d.to) !== me || !d.quad || !d.quad.head || !d.quad.manifestAddress) continue;
                let impostor = false;
                for (const it of byHead.values()) if (it.quad && String(it.quad.game) === String(d.game) && String(it.o) !== String(r.o)) impostor = true;
                if (impostor) { console.warn('[Received] ignored - ' + d.game + ' is published by a different key'); continue; }
                const item = String(d.item || d.game);
                if (recv.some((x: any) => x.quad.head === d.quad.head && x.item === item)) continue;
                recv.push({ game: String(d.game), item, quad: d.quad, dev: String(r.o), proof: String(d.txid || ''), t: r.t || Date.now() });
                const all: any = _g.__kvGrantsAll || (_g.__kvGrantsAll = {}); const l = all[d.game] || (all[d.game] = []); if (l.indexOf(item) < 0) l.push(item);
                ch = true;
                console.log('[Received] board ' + d.game + '/' + item + ' from ' + String(r.o).slice(0, 12));
              }
              if (ch) { await AS.setItem('kv_received_boards', JSON.stringify(recv)); await AS.setItem('kv_grants', JSON.stringify(_g.__kvGrantsAll || {})); }
            }
            for (const rb of recv) { const h = String(rb.quad.head); if (!byHead.has(h)) byHead.set(h, { name: rb.game + ' \\u00b7 ' + rb.item + ' (received)', category: 'Game', t: rb.t, o: rb.dev, quad: rb.quad, received: true }); }
          } catch (e) { console.warn('[Received]', e); }
          // KV_GAME_FLAGS tally:`],
  ] },
];

let ok = true; const staged = [];
for (const j of jobs) {
  let s = fs.readFileSync(j.f, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
  if (s.includes(j.marker)) { console.log(j.f + ': already patched - skipping'); continue; }
  for (const [a] of (j.edits || [])) { const c = s.split(a).length - 1; if (c !== 1) { console.error(j.f + ' ANCHOR count ' + c + ' expected 1: ' + a.slice(0, 60).replace(/\n/g, ' ')); ok = false; } }
  if (j.gate) {
    if (!/^[ \t]*const _ann: any = await announceToRegistry\(owner, manifestAddress, gameId/m.test(s)) { console.error(j.f + ' announce-only anchor not found'); ok = false; }
    if (!/runGrant\(([^)]+)\)/.test(s)) { console.error(j.f + ' GRANT button not found (run wire_board_grants first)'); ok = false; }
  }
  staged.push({ ...j, s, CRLF });
}
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const j of staged) {
  let s = j.s;
  if (j.gate) {
    const arg = s.match(/runGrant\(([^)]+)\)/)[1];
    j.edits = j.edits.map(([a, b]) => [a, b.split('${ARG}').join(arg)]);
  }
  for (const [a, b] of (j.edits || [])) s = s.split(a).join(b);
  if (j.append) s = s.replace(/\s*$/, '') + j.append;
  let gates = 0;
  if (j.gate) {
    s = s.replace(/^([ \t]*)((?:(?:const|let)\s+\w+(?::\s*any)?\s*=\s*|\w+\s*=\s*)?await announceToRegistry\()/gm, (m0, ind, rest) => { gates++; return ind + GATE.replace(/\n      /g, '\n' + ind) + ind + rest; });
  }
  fs.writeFileSync(j.f, j.CRLF ? s.replace(/\n/g, '\r\n') : s);
  console.log(j.f + ': patched' + (j.gate ? ' (send/unlisted gate before ' + gates + ' announce call(s))' : ''));
}
console.log('DONE - SEND BOARD (private delivery), UNLISTED publishing, Received boards in the Games lane, dev sales log.');
