// wire_mod_delist_v2.cjs — moderation-key honor in the games lane (v2:
// anchored on the diag-instrumented filter). Delists signed by KV_MOD_PUBKEY
// hide ANY head regardless of the announce's signer.
// TODO: rotate KV_MOD_PUBKEY to a dedicated cold key before mainnet.
const fs = require('fs');
const F = 'VillageMailbox.tsx';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('KV_MOD_PUBKEY')) { console.log('already patched'); process.exit(0); }

// 1. the moderation key, above the delist map
const A1 = "          const delistByHead = new Map<string, any>();";
const c1 = s.split(A1).length - 1;
if (c1 !== 1) { console.error('ANCHOR 1 count =', c1, '- expected 1. Aborting.'); process.exit(1); }
const B1 = "          // KV_MOD_PUBKEY: moderation key - its delists apply to any head. Rotate to a dedicated key before mainnet.\n          const KV_MOD_PUBKEY = '037d42aac927f9fad639cd0b479b3e921951d90361fd2e1e05d184f8122bf17133';\n" + A1;

// 2. final filter: mod key hides any head
const A2 = "            const keep = !!(d.o && it.o && d.o !== it.o);";
const c2 = s.split(A2).length - 1;
if (c2 !== 1) { console.error('ANCHOR 2 count =', c2, '- expected 1. Aborting.'); process.exit(1); }
const B2 = "            const keep = d.o === KV_MOD_PUBKEY ? false : !!(d.o && it.o && d.o !== it.o); // mod delist hides any head";

// 3. instant cache paint: same rule
const A3 = "setGames(Array.from(byHead.values()).filter((it: any) => { const d = delistByHead.get(it.quad.head); if (!d || !(d.t > it.t)) return true; return !!(d.o && it.o && d.o !== it.o); }) as any)";
const c3 = s.split(A3).length - 1;
if (c3 !== 1) { console.error('ANCHOR 3 count =', c3, '- expected 1. Aborting.'); process.exit(1); }
const B3 = "setGames(Array.from(byHead.values()).filter((it: any) => { const d = delistByHead.get(it.quad.head); if (!d || !(d.t > it.t)) return true; if (d.o === KV_MOD_PUBKEY) return false; return !!(d.o && it.o && d.o !== it.o); }) as any)";

s = s.replace(A1, B1).replace(A2, B2).replace(A3, B3);
if (CRLF) s = s.replace(/\n/g, '\r\n');
fs.writeFileSync(F, s);
console.log('patched: games lane honors moderation-key delists (final pass + instant paint)');
