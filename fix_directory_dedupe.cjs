// fix_directory_dedupe.cjs — rebuildDirectory kept ONE entry per OWNER
// pubkey, so a publisher could only ever have a single listing across all
// their stores/services/abstracts (diag: dir:1 cats:Services while the
// chain held 8+ announces). Dedupe by STORE ADDRESS instead - newest
// announce per address wins, every listing a publisher has shows up.
const fs = require('fs');
const F = 'kaspa_payload.ts';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('KV_DIR_BY_ADDR')) { console.log('already patched'); process.exit(0); }

const A1 = `  const byOwner = new Map<string, { record: KvRecord; blockTime: number }>();
  for (const a of anns) {
    const r = a.record;
    if (r.k !== 'registry') continue;
    if (!verifyRecord(r)) continue;
    if (!r.d?.storeAddress || !r.d?.name) continue;
    if (!byOwner.has(r.o)) byOwner.set(r.o, { record: r, blockTime: a.blockTime }); // newest first already
  }`;
const c1 = s.split(A1).length - 1;
if (c1 !== 1) { console.error('ANCHOR 1 count =', c1, '- expected 1. Aborting.'); process.exit(1); }
const B1 = `  // KV_DIR_BY_ADDR: one entry per STORE ADDRESS (newest announce wins).
  // Dedupe by owner was wrong - it limited every publisher to a single
  // listing across all their stores/services/abstracts.
  const byAddr = new Map<string, { record: KvRecord; blockTime: number }>();
  for (const a of anns) {
    const r = a.record;
    if (r.k !== 'registry') continue;
    if (!verifyRecord(r)) continue;
    if (!r.d?.storeAddress || !r.d?.name) continue;
    const _ak = String(r.d.storeAddress);
    if (!byAddr.has(_ak)) byAddr.set(_ak, { record: r, blockTime: a.blockTime }); // newest first already
  }`;

const A2 = `  for (const [owner, { record, blockTime }] of byOwner) {`;
const c2 = s.split(A2).length - 1;
if (c2 !== 1) { console.error('ANCHOR 2 count =', c2, '- expected 1. Aborting.'); process.exit(1); }
const B2 = `  for (const [, { record, blockTime }] of byAddr) {
    const owner = record.o;`;

s = s.split(A1).join(B1).split(A2).join(B2);
fs.writeFileSync(F, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log('patched: directory dedupes by store address - multiple listings per publisher');
