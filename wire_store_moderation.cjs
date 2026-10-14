// wire_store_moderation.cjs — reader-side enforcement in rebuildDirectory
// (feeds stores, services, academics, coupons, dapps):
// 1. PROHIBITED categories never render, whatever a modified client announces.
// 2. Registry delist records {k:'delist', d:{head:<storeAddress>}} are honored
//    when signed by the SAME publisher or by the moderation key — so the
//    DELIST mechanism from games works for every store-rail listing too.
// TODO: rotate KV_MOD_PUBKEY to a dedicated cold key before mainnet.
const fs = require('fs');
const F = 'kaspa_payload.ts';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('KV_PROHIBITED_RENDER')) { console.log('already patched'); process.exit(0); }

const A = `  const entries: DirectoryEntry[] = [];
  for (const [owner, { record, blockTime }] of byOwner) {
    if (record.del) continue;`;
const c = s.split(A).length - 1;
if (c !== 1) { console.error('ANCHOR count =', c, '- expected 1. Aborting.'); process.exit(1); }

const B = `  // KV_PROHIBITED_RENDER: reader-side enforcement - a modified client can
  // announce anything; this wallet simply will not display it.
  const KV_PROHIBITED = ['gambling', 'casino', 'betting', 'lottery'];
  const KV_MOD_PUBKEY = '037d42aac927f9fad639cd0b479b3e921951d90361fd2e1e05d184f8122bf17133';
  const delistByTarget = new Map<string, any>();
  for (const a of anns) {
    const r: any = a.record;
    if (r && r.k === 'delist' && r.d && r.d.head && verifyRecord(r)) {
      const tgt = String(r.d.head);
      const p = delistByTarget.get(tgt);
      if (!p || (r.t || 0) > (p.t || 0)) delistByTarget.set(tgt, r);
    }
  }
  const entries: DirectoryEntry[] = [];
  for (const [owner, { record, blockTime }] of byOwner) {
    if (record.del) continue;
    if (KV_PROHIBITED.indexOf(String(record.d.category || '').toLowerCase()) >= 0) continue;
    const _dl = delistByTarget.get(String(record.d.storeAddress));
    if (_dl && (_dl.o === owner || _dl.o === KV_MOD_PUBKEY) && (_dl.t || 0) > (record.t || 0)) continue;`;

s = s.replace(A, B);
if (CRLF) s = s.replace(/\n/g, '\r\n');
fs.writeFileSync(F, s);
console.log('patched: store rail drops prohibited categories + honors publisher/mod delists');
