// wire_game_flags.cjs — flags reach the games lane + signature check on game delists.
// 1. kaspa_payload: export kvFlaggerQualifies(pubkey, network) - pledge >= 10 KAS at one
//    of their store addresses OR >= 1 settled trade. Cached 10 min. Errors = not qualified.
// 2. Games lane parseAnn: verifies delist + flag signatures (before, a forged delist record
//    claiming the owner's or mod's pubkey would have been accepted - unsigned check).
// 3. Games lane: tallies flags per head; 3 qualified flaggers (not the owner) = hidden.
//    Counts go to globalThis.__kvFlagInfo (same as stores) for badge + owner alert.
const fs = require('fs');

const HELPER = `

// KV_FLAGGER_QUALIFIES: shared reputation gate for flags (games lane; stores tally inline)
export async function kvFlaggerQualifies(pubkey: string, network: string = 'testnet-10'): Promise<boolean> {
  const g: any = globalThis as any;
  const qc = g.__kvQualCache || (g.__kvQualCache = new Map());
  const hit = qc.get(pubkey);
  if (hit && Date.now() - hit.t < 600000) return hit.ok;
  let ok = false;
  try {
    // (a) live pledge >= 10 KAS at one of their store addresses
    if (!g.__kvStoreRegRecs || Date.now() - g.__kvStoreRegRecs.t > 600000) {
      const reg = require('./payload_publish').registryAddress('store', network);
      g.__kvStoreRegRecs = { t: Date.now(), rows: (await (fetchRecords as any)(reg, network, 100, 5)) || [] };
    }
    const addrs: string[] = [];
    for (const a of g.__kvStoreRegRecs.rows) {
      const r: any = a && a.record;
      if (!r || r.k !== 'registry' || r.o !== pubkey || !r.d) continue;
      const its: any[] = Array.isArray(r.d.batch) ? r.d.batch : [r.d];
      for (const it of its) if (it && it.storeAddress && addrs.indexOf(String(it.storeAddress)) < 0) addrs.push(String(it.storeAddress));
    }
    const api = String(network).indexOf('testnet') >= 0 ? 'https://api-tn10.kaspa.org' : 'https://api.kaspa.org';
    for (const addr of addrs.slice(0, 5)) {
      try {
        const j: any = await (await fetch(api + '/addresses/' + addr + '/balance')).json();
        if (Number((j && j.balance) || 0) >= 1_000_000_000) { ok = true; break; }
      } catch {}
    }
    // (b) at least one settled escrow trade
    if (!ok) {
      const { scanCounterparty } = require('./counterparty_scan');
      const sr: any = await scanCounterparty(pubkey, network, 40, true);
      ok = Number((sr && sr.settled) || 0) >= 1;
    }
  } catch { ok = false; }
  qc.set(pubkey, { ok, t: Date.now() });
  return ok;
}
`;

const jobs = [
  { f: 'kaspa_payload.ts', marker: 'KV_FLAGGER_QUALIFIES', append: HELPER },
  { f: 'VillageMailbox.tsx', marker: 'KV_GAME_FLAGS', edits: [
    ["            if (r && r.k === 'delist' && r.d && r.d.head) return { delist: true, head: String(r.d.head), t: r.t || 0, o: r.o || '' }; // KV_DELIST_FILTER",
     `            // KV_GAME_FLAGS: delists + flags must carry a valid signature (no forged owner/mod keys)
            if (r && (r.k === 'delist' || r.k === 'flag') && typeof kp.verifyRecord === 'function') { try { if (!kp.verifyRecord(r)) return null; } catch { return null; } }
            if (r && r.k === 'flag' && r.d && r.d.head) return { flag: true, head: String(r.d.head), reason: String(r.d.reason || ''), t: r.t || 0, o: r.o || '' };
            if (r && r.k === 'delist' && r.d && r.d.head) return { delist: true, head: String(r.d.head), t: r.t || 0, o: r.o || '' }; // KV_DELIST_FILTER`],
    ["          const take = (it: any) => {\n            if (!it) return;\n",
     "          const flagsByHead = new Map<string, Map<string, string>>(); // head -> flagger -> reason\n          const take = (it: any) => {\n            if (!it) return;\n            if (it.flag) { let m = flagsByHead.get(it.head); if (!m) { m = new Map(); flagsByHead.set(it.head, m); } m.set(String(it.o), it.reason); return; }\n"],
    ["          const items = Array.from(byHead.values()).filter((it: any) => {\n            const d = delistByHead.get(it.quad.head);",
     `          // KV_GAME_FLAGS tally: 3 qualified flaggers (pledge or settled trade, not the owner) = hidden
          try {
            const _g: any = globalThis as any; if (!_g.__kvFlagInfo) _g.__kvFlagInfo = new Map();
            for (const [h, m] of flagsByHead) {
              const it = byHead.get(h); if (!it) continue;
              m.delete(String(it.o));
              const ok: string[] = [];
              for (const [fk, why] of m) { try { if (await kp.kvFlaggerQualifies(fk, 'testnet-10')) ok.push(why); } catch {} }
              const info = { n: ok.length, reasons: Array.from(new Set(ok)), owner: String(it.o), name: String(it.name || '') };
              if (ok.length >= 3) { _g.__kvFlagInfo.set(h, { ...info, hidden: true }); byHead.delete(h); console.warn('[GamesLane] hidden by', ok.length, 'flags:', h.slice(0, 8), info.reasons.join(',')); }
              else if (ok.length) { _g.__kvFlagInfo.set(h, info); console.log('[GamesLane] flags', ok.length + '/3', h.slice(0, 8)); }
              else _g.__kvFlagInfo.delete(h);
            }
          } catch (e) { console.warn('[GamesLane] flag tally error', e); }
          const items = Array.from(byHead.values()).filter((it: any) => {
            const d = delistByHead.get(it.quad.head);`],
  ] },
];

let ok = true; const staged = [];
for (const j of jobs) {
  let s = fs.readFileSync(j.f, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
  if (s.includes(j.marker)) { console.log(j.f + ': already patched - skipping'); continue; }
  for (const [a] of (j.edits || [])) { const c = s.split(a).length - 1; if (c !== 1) { console.error(j.f + ' ANCHOR count ' + c + ' expected 1: ' + a.slice(0, 60)); ok = false; } }
  staged.push({ ...j, s, CRLF });
}
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const j of staged) {
  let s = j.s;
  for (const [a, b] of (j.edits || [])) s = s.split(a).join(b);
  if (j.append) s = s.replace(/\s*$/, '') + j.append;
  fs.writeFileSync(j.f, j.CRLF ? s.replace(/\n/g, '\r\n') : s);
  console.log(j.f + ': patched');
}
console.log('DONE - games lane: signed delists/flags only, 3 qualified flags = hidden.');
