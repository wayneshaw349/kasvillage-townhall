// fix_timetier_search.cjs — two bugs in the mailbox time-tier search:
// 1. The age filter read item.t, which only the games lane sets; store-rail
//    entries (stores/services/academics/dapps/coupons) carry createdAt, so
//    "shoes week" silently filtered nothing for them.
// 2. The tier regex had no leading word boundary and \s* allows zero spaces,
//    so "sunday" matched the `day` unit: query became "sun" with a bogus
//    1-day cutoff. Same for monday/holiday/everyday.
const fs = require('fs');
const F = 'VillageMailbox.tsx';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('KV_TIER_FIX')) { console.log('already patched'); process.exit(0); }

// --- 1. regex: require a word boundary before the tier phrase ---
const A1 = "    const tm = q.match(/(?:last\\s+)?(\\d+)?\\s*(hour|day|week|month)s?\\b/);";
const c1 = s.split(A1).length - 1;
if (c1 !== 1) { console.error('ANCHOR 1 count =', c1, '- expected 1. Aborting.'); process.exit(1); }
const B1 = "    // KV_TIER_FIX: leading \\b so 'sunday'/'holiday' are not read as time tiers\n    const tm = q.match(/\\b(?:last\\s+)?(\\d+)?\\s*(hour|day|week|month)s?\\b/);";

// --- 2. age field: games use t, store rail uses createdAt ---
const A2 = "      if (cutoff && item.t && item.t < cutoff) return false;";
const c2 = s.split(A2).length - 1;
if (c2 !== 1) { console.error('ANCHOR 2 count =', c2, '- expected 1. Aborting.'); process.exit(1); }
const B2 = "      const _age = item.t || item.createdAt || 0; // KV_TIER_FIX: store rail carries createdAt\n      if (cutoff && _age && _age < cutoff) return false;";

s = s.replace(A1, B1).replace(A2, B2);
if (CRLF) s = s.replace(/\n/g, '\r\n');
fs.writeFileSync(F, s);
console.log('patched: time tiers now apply to every lane; word-boundary guard added');
