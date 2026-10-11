// fix_delist_cache_ts.cjs — two delist fixes in the games lane:
// 1. Timestamp semantics: a delist hides a listing only while it is NEWER than
//    the latest announce — so DELIST hides, a later ANNOUNCE restores.
// 2. Delist cache: delists persist on-device (kv_game_delist_cache) just like
//    quads, so cache-first paints honor them too — not only fresh fetches.
// Works whether or not wire_mod_delist has been applied.
const fs = require('fs');
const F = 'VillageMailbox.tsx';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('kv_game_delist_cache')) { console.log('already patched'); process.exit(0); }

// --- 1. load cached delists alongside the quad cache ---
const A1 = "          try { const cRaw = await AS.getItem('kv_game_registry_cache'); (cRaw ? JSON.parse(cRaw) : []).forEach(take); } catch {}";
const c1 = s.split(A1).length - 1;
if (c1 !== 1) { console.error('ANCHOR 1 count =', c1, '- expected 1. Aborting.'); process.exit(1); }
s = s.replace(A1, A1 + "\n          try { const dRaw = await AS.getItem('kv_game_delist_cache'); (dRaw ? JSON.parse(dRaw) : []).forEach(take); } catch {}");

// --- 2. timestamp-aware hide: delist must outdate the latest announce ---
const A2 = "            const d = delistByHead.get(it.quad.head);\n            if (!d) return true;";
const c2 = s.split(A2).length - 1;
if (c2 !== 1) { console.error('ANCHOR 2 count =', c2, '- expected 1. Aborting.'); process.exit(1); }
s = s.replace(A2, "            const d = delistByHead.get(it.quad.head);\n            if (!d || !(d.t > it.t)) return true; // delist hides only while newer than the latest announce");

// --- 3. persist collected delists for cache-first paints ---
const A3 = "          }).sort((a, b) => b.t - a.t);";
const c3 = s.split(A3).length - 1;
if (c3 !== 1) { console.error('ANCHOR 3 count =', c3, '- expected 1. Aborting.'); process.exit(1); }
s = s.replace(A3, A3 + "\n          try { if (delistByHead.size) await AS.setItem('kv_game_delist_cache', JSON.stringify(Array.from(delistByHead.values()))); } catch {}");

if (CRLF) s = s.replace(/\n/g, '\r\n');
fs.writeFileSync(F, s);
console.log('patched: delists cached on-device + hide only while newer than latest announce');
