// add_games_lane_diag.cjs — [GamesLane] diagnostics: how many delists loaded,
// each keep/hide decision with timestamps and signers, and the final count.
// Read the Metro log after searching the Games tab; remove later if noisy.
const fs = require('fs');
const F = 'VillageMailbox.tsx';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('[GamesLane]')) { console.log('already patched'); process.exit(0); }

// 1. after loading the delist cache, report how many came in
const A1 = "          try { const dRaw = await AS.getItem('kv_game_delist_cache'); (dRaw ? JSON.parse(dRaw) : []).forEach(take); } catch {}";
const c1 = s.split(A1).length - 1;
if (c1 !== 1) { console.error('ANCHOR 1 count =', c1, '- expected 1. Aborting.'); process.exit(1); }
s = s.replace(A1, A1 + "\n          try { console.log('[GamesLane] run: cachedQuads=' + byHead.size + ' cachedDelists=' + delistByHead.size); } catch {}");

// 2. logged filter decisions in the final items pass
const A2 = `            const d = delistByHead.get(it.quad.head);
            if (!d || !(d.t > it.t)) return true; // delist hides only while newer than the latest announce
            return !!(d.o && it.o && d.o !== it.o); // same signer (or unknown signer) -> hidden`;
const c2 = s.split(A2).length - 1;
if (c2 !== 1) { console.error('ANCHOR 2 count =', c2, '- expected 1. Aborting.'); process.exit(1); }
const B2 = `            const d = delistByHead.get(it.quad.head);
            if (!d) return true;
            if (!(d.t > it.t)) { try { console.log('[GamesLane] delist OUTRANKED for ' + it.quad.head.slice(0, 8) + ' delist.t=' + d.t + ' announce.t=' + it.t); } catch {} return true; }
            const keep = !!(d.o && it.o && d.o !== it.o);
            try { console.log('[GamesLane] ' + (keep ? 'KEPT(signer mismatch) ' : 'HIDDEN ') + it.quad.head.slice(0, 8) + ' d.o=' + String(d.o).slice(0, 10) + ' it.o=' + String(it.o).slice(0, 10)); } catch {}
            return keep;`;
s = s.replace(A2, B2);

// 3. summary after the filter
const A3 = "          try { if (delistByHead.size) await AS.setItem('kv_game_delist_cache', JSON.stringify(Array.from(delistByHead.values()))); } catch {}";
const c3 = s.split(A3).length - 1;
if (c3 !== 1) { console.error('ANCHOR 3 count =', c3, '- expected 1. Aborting.'); process.exit(1); }
s = s.replace(A3, "          try { console.log('[GamesLane] done: shown=' + items.length + ' delists=' + delistByHead.size + ' heads=' + Array.from(delistByHead.keys()).map((h: string) => h.slice(0, 8)).join(',')); } catch {}\n" + A3);

if (CRLF) s = s.replace(/\n/g, '\r\n');
fs.writeFileSync(F, s);
console.log('patched: [GamesLane] diagnostics in place');
