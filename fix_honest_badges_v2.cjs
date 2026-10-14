// fix_honest_badges_v2.cjs — v1's 6-space anchor was a substring of the
// 8-space services line (count=2). v2 anchors each line from its leading
// newline, so indentation is exact and the services copy can't match.
// Fix 1: fetchStorefronts townhall.verified hardcoded true -> false.
// Fix 2: fetchDApps drops the `|| !!gameHash` verified bypass.
const fs = require('fs');
const F = 'mailbox_kaspa_api.ts';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('KV_HONEST_BADGE')) { console.log('already patched'); process.exit(0); }

// --- 1. store badge (exactly 6-space indent, newline-anchored) ---
const A1 = "\n      townhall: { verified: true, verifiedAt: e.announcedAt, verificationTx: e.storeAddress },";
const c1 = s.split(A1).length - 1;
if (c1 !== 1) { console.error('ANCHOR 1 count =', c1, '- expected 1. Aborting.'); process.exit(1); }
const B1 = "\n      townhall: { verified: false, verifiedAt: e.announcedAt, verificationTx: e.storeAddress }, // KV_HONEST_BADGE: stores are pledge-anchored, not TownHall-verified";

// --- 2. dapp badge: drop the gameHash bypass ---
const A2 = "\n        templateVerified: attestValid || !!gameHash,\n        townhall: { verified: attestValid || !!gameHash, verifiedAt: attest?.generatedAt || e.announcedAt, verificationTx: e.storeAddress },";
const c2 = s.split(A2).length - 1;
if (c2 !== 1) { console.error('ANCHOR 2 count =', c2, '- expected 1. Aborting.'); process.exit(1); }
const B2 = "\n        templateVerified: attestValid, // KV_HONEST_BADGE: hash presence is integrity (checked at install), not verification\n        townhall: { verified: attestValid, verifiedAt: attest?.generatedAt || e.announcedAt, verificationTx: e.storeAddress },";

s = s.replace(A1, B1).replace(A2, B2);
if (CRLF) s = s.replace(/\n/g, '\r\n');
fs.writeFileSync(F, s);
console.log('patched: store badge honest (verified:false), dapp badge = attestValid only');
