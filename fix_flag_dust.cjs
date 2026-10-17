// fix_flag_dust.cjs — flags cost 0.1 KAS (REPOST_SOMPI, proven on TN10) instead of 1,
// so reporting is cheap. Mod clear stays 1 KAS. Run AFTER wire_flags.cjs.
const fs = require('fs');
const jobs = [
  { f: 'payload_publish.ts', marker: 'KV_FLAG_DUST', all: [], edits: [
    ["d: { head, reason } } as any, owner.privateKeyHex);\n  const regAddr = registryAddress(kind, owner.network);\n  const res = await sendKaspaViaRest({\n    senderAddress: owner.address,\n    recipientAddress: regAddr,\n    amountSompi: ANNOUNCE_SOMPI,",
     "d: { head, reason } } as any, owner.privateKeyHex);\n  const regAddr = registryAddress(kind, owner.network);\n  const res = await sendKaspaViaRest({\n    senderAddress: owner.address,\n    recipientAddress: regAddr,\n    amountSompi: REPOST_SOMPI, // KV_FLAG_DUST: 0.1 KAS - cheap to report"],
  ] },
  { f: 'VillageMailbox.tsx', marker: 'Flag this listing (0.1 KAS)', all: [
    ['Flag this listing (~1 KAS)', 'Flag this listing (0.1 KAS)', 2],
    ["'Flag this listing? (~1 KAS)'", "'Flag this listing? (0.1 KAS)'", 1],
  ], edits: [] },
];
let ok = true; const staged = [];
for (const j of jobs) {
  let s = fs.readFileSync(j.f, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
  if (s.includes(j.marker)) { console.log(j.f + ': already patched - skipping'); continue; }
  for (const [a, , w] of j.all) { const c = s.split(a).length - 1; if (c !== w) { console.error(j.f + ' count ' + c + ' expected ' + w + ' for: ' + a + ' (run wire_flags.cjs first)'); ok = false; } }
  for (const [a] of j.edits) { const c = s.split(a).length - 1; if (c !== 1) { console.error(j.f + ' ANCHOR count ' + c + ' expected 1 (run wire_flags.cjs first)'); ok = false; } }
  staged.push({ ...j, s, CRLF });
}
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const j of staged) { let s = j.s; for (const [a, b] of j.all) s = s.split(a).join(b); for (const [a, b] of j.edits) s = s.split(a).join(b); fs.writeFileSync(j.f, j.CRLF ? s.replace(/\n/g, '\r\n') : s); console.log(j.f + ': patched'); }
console.log('DONE - flags now 0.1 KAS.');
