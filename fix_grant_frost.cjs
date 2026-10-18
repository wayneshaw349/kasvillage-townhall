// fix_grant_frost.cjs — grants accept a FROST agreement ID as payment proof + price threshold.
//  Workspace   : GRANT proof prompt takes a 64-hex txid OR an AGR_ agreement ID.
//                MY CONTACT also asks board price + "FROST above" (default 20 KAS);
//                both ride in the next ANNOUNCE (never shown on the card - Apple).
//  Mailbox lane: AGR_ proofs verified against the buyer's own Phone Proof chain
//                (agreement complete + counterparty == the game's publisher); unverified
//                proofs are re-checked on later refreshes (agreement may finish after the grant).
//  Card        : Contact developer message states the price and asks for FROST above the line.
const fs = require('fs');
const AS = "require('@react-native-async-storage/async-storage').default";
const jobs = [
  { f: 'Workspace.tsx', marker: 'KV_GRANT_FROST', edits: [
    ["ask('Grant - payment txid', 'The buyer\\'s payment transaction id (proof it was paid).', (txid) => {\n          txid = txid.toLowerCase().replace(/[^0-9a-f]/g, '');\n          if (!/^[0-9a-f]{64}$/.test(txid)) { Alert.alert('Bad txid', 'A transaction id is 64 hex characters.'); return; }",
     "ask('Grant - payment proof', 'Payment txid (64 hex) for a direct send, or the agreement ID (AGR_...) for a FROST agreement.', (txid) => { // KV_GRANT_FROST\n          const _agr = /^AGR_[A-Za-z0-9]+$/.test(txid.trim()) ? txid.trim() : '';\n          txid = _agr || txid.toLowerCase().replace(/[^0-9a-f]/g, '');\n          if (!_agr && !/^[0-9a-f]{64}$/.test(txid)) { Alert.alert('Bad proof', 'Enter a 64-hex txid or an AGR_ agreement ID.'); return; }"],
    [AS + ".getItem('kv_dev_contact').then((v: any) => { if (v) _g.__kvDevContact = v; });",
     AS + ".getItem('kv_dev_contact').then((v: any) => { if (v) _g.__kvDevContact = v; }); " + AS + ".getItem('kv_dev_price').then((v: any) => { try { if (v) _g.__kvDevPrice = JSON.parse(v); } catch {} });"],
    ["Alert.alert('Saved', v ? 'Re-ANNOUNCE the game so the contact reaches the card.' : 'Contact cleared.'); } },",
     `const _cur: any = (globalThis as any).__kvDevPrice || {};
        setTimeout(() => require('./kv_prompt').kvPrompt('Board price (KAS)', 'Your usual price per board. Only inside the buyer\\'s message, never shown on the card. 0 = none.', [
          { text: 'Next', onPress: (p: string) => {
            const price = Number(String(p || '').replace(/[^0-9.]/g, '')) || 0;
            setTimeout(() => require('./kv_prompt').kvPrompt('FROST above (KAS)', 'Purchases at or above this use a FROST agreement (buyer protection). Below it: direct send + txid.', [
              { text: 'Save', onPress: async (f: string) => {
                const frostAbove = Number(String(f || '').replace(/[^0-9.]/g, '')) || 20;
                (globalThis as any).__kvDevPrice = { price, frostAbove };
                try { await ${AS}.setItem('kv_dev_price', JSON.stringify({ price, frostAbove })); } catch {}
                Alert.alert('Saved', 'Re-ANNOUNCE the game so your contact and pricing reach buyers.');
              } },
            ], 'plain-text', String(_cur.frostAbove || 20)), 450);
          } },
        ], 'plain-text', String(_cur.price || '')), 450); } },`],
  ], quadSwap: true },
  { f: 'VillageMailbox.tsx', marker: 'KV_GRANT_AGR', edits: [
    ["                if (!proofs.some((p: any) => p.game === game && p.item === item && p.txid === String(d.txid || ''))) {",
     "                const _old = proofs.find((p: any) => p.game === game && p.item === item && p.txid === String(d.txid || '')); // KV_GRANT_AGR\n                if (!_old || !_old.verified) {"],
    ["                  try { v = await kp.kvVerifyPayment(String(d.txid || ''), payTo.get(game) || '', 'testnet-10'); } catch {}",
     `                  try {
                    const _ref = String(d.txid || '');
                    if (/^AGR_/.test(_ref)) {
                      const sr = require('./stat_records'); const chain: any[] = await sr.loadChain();
                      const xo = (k: string) => String(k || '').replace(/^0[23]/, '').toLowerCase();
                      const rec = (chain || []).find((c: any) => c.agrId === _ref);
                      if (rec && rec.outcome === 'complete' && xo(rec.cpPubkey) === xo(String(r.o))) v = { ok: true, amountKas: Number(rec.buyerAmountSompi || 0) / 1e8, agr: true, releaseTxId: (rec.anchor && rec.anchor.releaseTxId) || '' };
                    } else v = await kp.kvVerifyPayment(_ref, payTo.get(game) || '', 'testnet-10');
                  } catch {}
                  if (_old) { if (!v.ok) continue; proofs.splice(proofs.indexOf(_old), 1); }`],
    ["proofs.push({ game, item, txid: String(d.txid || ''), dev: String(r.o), verified: !!v.ok, amountKas: v.amountKas || 0, grant: r, savedAt: Date.now() });",
     "proofs.push({ game, item, txid: String(d.txid || ''), dev: String(r.o), verified: !!v.ok, amountKas: v.amountKas || 0, agr: !!v.agr, releaseTxId: v.releaseTxId || '', grant: r, savedAt: Date.now() });"],
    ["const msg = 'Hi! I play ' + (item.name || item.quad.game) + ' on KasVillage and would like the next board. My pubkey: ' + me;",
     "const _p = Number(item.quad.price || 0), _fa = Number(item.quad.frostAbove || 20);\n            const msg = 'Hi! I play ' + (item.name || item.quad.game) + ' on KasVillage and would like the next board' + (_p ? ' (' + _p + ' KAS)' : '') + '. ' + (_p && _p >= _fa ? 'It is ' + _fa + '+ KAS, so let\\'s use a FROST agreement. ' : (_p ? 'I will send to the address on the game card and give you the txid. ' : '')) + 'My pubkey: ' + me;"],
  ] },
];
const QA = "...((globalThis as any).__kvDevContact ? { contact: (globalThis as any).__kvDevContact } : {})";
const QB = QA + ", ...((globalThis as any).__kvDevPrice && (globalThis as any).__kvDevPrice.price ? { price: (globalThis as any).__kvDevPrice.price, frostAbove: (globalThis as any).__kvDevPrice.frostAbove || 20 } : {})";
let ok = true; const staged = [];
for (const j of jobs) {
  let s = fs.readFileSync(j.f, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
  if (s.includes(j.marker)) { console.log(j.f + ': already patched - skipping'); continue; }
  for (const [a] of j.edits) { const c = s.split(a).length - 1; if (c !== 1) { console.error(j.f + ' ANCHOR count ' + c + ' expected 1: ' + a.slice(0, 70).replace(/\n/g, ' ')); ok = false; } }
  if (j.quadSwap) { j.qn = s.split(QA).length - 1; if (j.qn < 1) { console.error(j.f + ' quad contact anchor not found (run wire_board_grants first)'); ok = false; } }
  staged.push({ ...j, s, CRLF });
}
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const j of staged) {
  let s = j.s;
  for (const [a, b] of j.edits) s = s.split(a).join(b);
  if (j.quadSwap) s = s.split(QA).join(QB);
  fs.writeFileSync(j.f, j.CRLF ? s.replace(/\n/g, '\r\n') : s);
  console.log(j.f + ': patched' + (j.quadSwap ? ' (price added to ' + j.qn + ' quad site(s))' : ''));
}
console.log('DONE - grants accept AGR_ agreement IDs; price + FROST threshold in the buyer message.');
