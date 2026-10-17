// wire_flag_gate.cjs — flag reputation gate: a flag counts if the flagger has
//   (a) a LIVE PLEDGE >= 10 KAS at one of their store addresses, OR
//   (b) at least 1 SETTLED escrow trade (counterparty scan, cached 10 min).
// Buyers with no store can now flag (they're the ones who get scammed).
// Any lookup error = flag does not count (never delist on an error).
// Replaces wire_flag_pledge_gate.cjs; safe whether or not that one was run.
const fs = require('fs');
const F = 'kaspa_payload.ts';
let s = fs.readFileSync(F, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
if (s.includes('KV_FLAG_TRADE_GATE')) { console.log('already patched'); process.exit(0); }

const TRADE = `      // KV_FLAG_TRADE_GATE: no pledge? a settled escrow trade also qualifies
      for (const fk of _flaggers) {
        if (_pledged.has(fk)) continue;
        try {
          const tc = _g.__kvTradeCache || (_g.__kvTradeCache = new Map());
          const hit = tc.get(fk);
          let settled = -1;
          if (hit && Date.now() - hit.t < 600000) settled = hit.n;
          else {
            const { scanCounterparty } = require('./counterparty_scan');
            const sr: any = await scanCounterparty(fk, String(network), 40, true);
            settled = Number((sr && sr.settled) || 0);
            tc.set(fk, { n: settled, t: Date.now() });
          }
          if (settled >= 1) _pledged.add(fk);
        } catch {}
      }
`;
const DROP = "      for (const m of _kvFlagsBy.values()) for (const k of Array.from(m.keys())) if (!_pledged.has(k)) { m.delete(k); console.log('[Flags] ignored - flagger has no live pledge:', k.slice(0, 12)); }";
const DROP2 = "      for (const m of _kvFlagsBy.values()) for (const k of Array.from(m.keys())) if (!_pledged.has(k)) { m.delete(k); console.log('[Flags] ignored - flagger has no pledge or settled trade:', k.slice(0, 12)); }";
const PUB = "    if (!_kvPublishers.has(String(r.o))) continue;          // reputation gate: flagger must be a listed publisher\n";
const PUB2 = "    // KV_FLAG_TRADE_GATE: listed-publisher gate replaced by pledge-or-trade gate below\n";

const edits = [[PUB, PUB2]];
if (s.includes('KV_FLAG_PLEDGE_GATE')) {
  edits.push([DROP, TRADE + DROP2]);
} else {
  const A = "    m.set(String(r.o), String(r.d.reason || ''));\n  }\n  const delistByTarget = new Map<string, any>();";
  const B = `    m.set(String(r.o), String(r.d.reason || ''));
  }
  // KV_FLAG_PLEDGE_GATE: flagger must have a live pledge (>= 10 KAS at one of their store addresses)
  const KV_FLAG_MIN_PLEDGE = 1_000_000_000; // sompi = 10 KAS (locked, not burned - recoverable)
  try {
    const _flaggers = new Set<string>();
    for (const m of _kvFlagsBy.values()) for (const k of m.keys()) _flaggers.add(k);
    if (_flaggers.size) {
      const _stores = new Map<string, string[]>();
      for (const a of anns) {
        const r: any = a.record;
        if (r && r.k === 'registry' && r.o && r.d && r.d.storeAddress && _flaggers.has(String(r.o))) {
          const l = _stores.get(String(r.o)) || [];
          if (l.indexOf(String(r.d.storeAddress)) < 0) l.push(String(r.d.storeAddress));
          _stores.set(String(r.o), l);
        }
      }
      const _g: any = globalThis as any; if (!_g.__kvPledgeCache) _g.__kvPledgeCache = new Map();
      const _api = String(network).indexOf('testnet') >= 0 ? 'https://api-tn10.kaspa.org' : 'https://api.kaspa.org';
      const _pledged = new Set<string>();
      for (const fk of _flaggers) {
        for (const addr of (_stores.get(fk) || []).slice(0, 5)) {
          let bal = -1;
          const ch = _g.__kvPledgeCache.get(addr);
          if (ch && Date.now() - ch.t < 600000) bal = ch.b;
          else {
            try {
              const j: any = await (await fetch(_api + '/addresses/' + addr + '/balance')).json();
              bal = Number((j && j.balance) || 0);
              _g.__kvPledgeCache.set(addr, { b: bal, t: Date.now() });
            } catch {}
          }
          if (bal >= KV_FLAG_MIN_PLEDGE) { _pledged.add(fk); break; }
        }
      }
${TRADE}${DROP2}
    }
  } catch (e) { console.warn('[Flags] gate error', e); }
  const delistByTarget = new Map<string, any>();`;
  edits.push([A, B]);
}
let ok = true;
for (const [a] of edits) { const c = s.split(a).length - 1; if (c !== 1) { console.error('ANCHOR count =', c, '- expected 1 (run wire_flags.cjs first)'); ok = false; } }
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const [a, b] of edits) s = s.split(a).join(b);
fs.writeFileSync(F, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log('patched: flags count from flaggers with a live pledge (>= 10 KAS) OR a settled trade');
