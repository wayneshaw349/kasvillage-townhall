// fix_received_accept.cjs — no unsolicited content: received boards from unknown senders wait
// for the player. Known senders (publisher of a public game in the lane, or someone you have a
// completed FROST agreement with) are auto-accepted. Unknown -> popup:
//   Accept  -> shows as a received card (+ KV_GRANTS)
//   Ignore  -> never shown, never asked again
//   Report  -> ignored + opens the flag reason picker on that board's head (0.1 KAS, on chain)
// Boards received before this patch stay accepted.
const fs = require('fs');
const F = 'VillageMailbox.tsx';
let s = fs.readFileSync(F, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
if (s.includes('KV_RECEIVED_ACCEPT')) { console.log('already patched'); process.exit(0); }
const A1 = "                if (recv.some((x: any) => x.quad.head === d.quad.head && x.item === item)) continue;\n                recv.push({ game: String(d.game), item, quad: d.quad, dev: String(r.o), proof: String(d.txid || ''), t: r.t || Date.now() });\n                const all: any = _g.__kvGrantsAll || (_g.__kvGrantsAll = {}); const l = all[d.game] || (all[d.game] = []); if (l.indexOf(item) < 0) l.push(item);\n                ch = true;";
const B1 = `                if (recv.some((x: any) => x.quad.head === d.quad.head && x.item === item)) continue;
                // KV_RECEIVED_ACCEPT: known sender = publishes a public game here, or completed a FROST agreement with you
                let known = false;
                for (const it of byHead.values()) if (it.quad && !it.received && String(it.o) === String(r.o)) known = true;
                if (!known) { try { const _sr = require('./stat_records'); const _ch: any[] = await _sr.loadChain(); const _xo = (k: string) => String(k || '').replace(/^0[23]/, '').toLowerCase(); known = (_ch || []).some((c: any) => c.outcome === 'complete' && _xo(c.cpPubkey) === _xo(String(r.o))); } catch {} }
                recv.push({ game: String(d.game), item, quad: d.quad, dev: String(r.o), proof: String(d.txid || ''), t: r.t || Date.now(), status: known ? 'accepted' : 'pending' });
                if (known) { const all: any = _g.__kvGrantsAll || (_g.__kvGrantsAll = {}); const l = all[d.game] || (all[d.game] = []); if (l.indexOf(item) < 0) l.push(item); }
                ch = true;`;
const A2 = "            for (const rb of recv) { const h = String(rb.quad.head); if (!byHead.has(h)) byHead.set(h, {";
const B2 = `            const pend: any = recv.find((x: any) => x.status === 'pending');
            if (pend && _g.__kvPendingShown !== pend.quad.head) {
              _g.__kvPendingShown = pend.quad.head;
              const _save = async () => { try { await AS.setItem('kv_received_boards', JSON.stringify(recv)); } catch {} };
              setTimeout(() => require('./kv_prompt').kvChoose('Board received', String(pend.dev).slice(0, 12) + '\\u2026 sent you "' + pend.item + '" for ' + pend.game + '. You have not traded with this sender. Show it?', [
                { text: 'Accept', onPress: async () => { pend.status = 'accepted'; const all: any = _g.__kvGrantsAll || (_g.__kvGrantsAll = {}); const l = all[pend.game] || (all[pend.game] = []); if (l.indexOf(pend.item) < 0) l.push(pend.item); await _save(); try { await AS.setItem('kv_grants', JSON.stringify(all)); } catch {} _g.__kvPendingShown = null; Alert.alert('Accepted', 'Pull to refresh Games to see it.'); } },
                { text: 'Ignore', style: 'cancel', onPress: async () => { pend.status = 'ignored'; await _save(); _g.__kvPendingShown = null; } },
                { text: 'Report', style: 'destructive', onPress: async () => { pend.status = 'ignored'; await _save(); _g.__kvPendingShown = null; const f = _g.__kvRunFlag; if (f) f({ arweaveTx: String(pend.quad.head), id: String(pend.quad.head), ownerPubkey: pend.dev, name: pend.game + ' ' + pend.item }, 'game'); } },
              ]), 800);
            }
            for (const rb of recv) { if (rb.status === 'pending' || rb.status === 'ignored') continue; const h = String(rb.quad.head); if (!byHead.has(h)) byHead.set(h, {`;
let ok = true;
for (const [n, a] of [['received push', A1], ['received list', A2]]) { const c = s.split(a).length - 1; if (c !== 1) { console.error(n + ' ANCHOR count ' + c + ' expected 1 (run wire_send_board first)'); ok = false; } }
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
s = s.split(A1).join(B1).split(A2).join(B2);
fs.writeFileSync(F, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log('patched: unknown senders need Accept / Ignore / Report before a received board shows');
