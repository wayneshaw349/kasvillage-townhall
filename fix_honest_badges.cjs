// fix_honest_badges.cjs — two honesty fixes in mailbox_kaspa_api.ts:
// 1. fetchStorefronts: townhall.verified was hardcoded true for every store.
//    Nothing TownHall-shaped ever ran -> verified: false. The real trust
//    signal for stores is the pledge (already in visSort); a "Pledge-anchored"
//    label can read from pledge, not this flag.
// 2. fetchDApps: `attestValid || !!gameHash` let a bare configHash light up
//    the verified badge. Hash presence is an integrity pointer (checked at
//    install), not verification -> badge follows attestValid alone.
// NOTE: coupons(193) and services(248) still hardcode verified:true — same
// pattern, left for the attestation pass; say the word to flip those too.
const fs = require('fs');
const F = 'mailbox_kaspa_api.ts';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('KV_HONEST_BADGE')) { console.log('already patched'); process.exit(0); }

// --- 1. store badge (6-space indent = fetchStorefronts; services copy is 8-space) ---
const A1 = "      townhall: { verified: true, verifiedAt: e.announcedAt, verificationTx: e.storeAddress },";
const c1 = s.split(A1).length - 1;
if (c1 !== 1) { console.error('ANCHOR 1 count =', c1, '- expected 1. Aborting.'); process.exit(1); }
const B1 = "      townhall: { verified: false, verifiedAt: e.announcedAt, verificationTx: e.storeAddress }, // KV_HONEST_BADGE: stores are pledge-anchored, not TownHall-verified";

// --- 2. dapp badge: drop the gameHash bypass ---
const A2 = "        templateVerified: attestValid || !!gameHash,\n        townhall: { verified: attestValid || !!gameHash, verifiedAt: attest?.generatedAt || e.announcedAt, verificationTx: e.storeAddress },";
const c2 = s.split(A2).length - 1;
if (c2 !== 1) { console.error('ANCHOR 2 count =', c2, '- expected 1. Aborting.'); process.exit(1); }
const B2 = "        templateVerified: attestValid, // KV_HONEST_BADGE: hash presence is integrity (checked at install), not verification\n        townhall: { verified: attestValid, verifiedAt: attest?.generatedAt || e.announcedAt, verificationTx: e.storeAddress },";

s = s.replace(A1, B1).replace(A2, B2);
if (CRLF) s = s.replace(/\n/g, '\r\n');
fs.writeFileSync(F, s);
console.log('patched: store badge honest (verified:false), dapp badge = attestValid only');
