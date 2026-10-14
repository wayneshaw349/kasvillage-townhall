// wire_mod_delist.cjs — publisher (moderation) delist, reader side.
// Delist records signed by KV_MOD_PUBKEY are honored for ANY head, regardless
// of the announce's signer — the app-publisher curation layer over the
// developer self-delist. Posting one is just delistFromRegistry() called with
// the moderation key; no new rail needed.
// TODO: rotate KV_MOD_PUBKEY to a dedicated cold moderation key before mainnet.
const fs = require('fs');
const F = 'VillageMailbox.tsx';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('KV_MOD_PUBKEY')) { console.log('already patched'); process.exit(0); }

// --- 1. the moderation key, next to the delist map ---
const A1 = "          const delistByHead = new Map<string, any>();";
const c1 = s.split(A1).length - 1;
if (c1 !== 1) { console.error('ANCHOR 1 count =', c1, '- expected 1 (run wire_games_delist_filter first). Aborting.'); process.exit(1); }
const B1 = "          // KV_MOD_PUBKEY: moderation key - its delists apply to any head. Rotate to a dedicated key before mainnet.\n          const KV_MOD_PUBKEY = '037d42aac927f9fad639cd0b479b3e921951d90361fd2e1e05d184f8122bf17133';\n" + A1;

// --- 2. filter: signer match OR moderation key ---
const A2 = `            const d = delistByHead.get(it.quad.head);
            if (!d) return true;
            return !!(d.o && it.o && d.o !== it.o); // same signer (or unknown signer) -> hidden`;
const c2 = s.split(A2).length - 1;
if (c2 !== 1) { console.error('ANCHOR 2 count =', c2, '- expected 1. Aborting.'); process.exit(1); }
const B2 = `            const d = delistByHead.get(it.quad.head);
            if (!d) return true;
            if (d.o === KV_MOD_PUBKEY) return false; // moderation delist: any head
            return !!(d.o && it.o && d.o !== it.o); // same signer (or unknown signer) -> hidden`;

s = s.replace(A1, B1).replace(A2, B2);
if (CRLF) s = s.replace(/\n/g, '\r\n');
fs.writeFileSync(F, s);
console.log('patched: moderation-key delists honored for any head');
