// wire_mod_legal.cjs — moderation step 4: law-enforcement lane.
// - Mod delist picker gains "Legal request". The private prompt asks for agency +
//   case/subpoena number; only its hash goes on chain (preimage kept in kv_mod_log).
// - Owners are now told when the MODERATOR removed their listing (any reason),
//   with the public reason, via the same once-per-change alert as flags.
const fs = require('fs');
const jobs = [
  { f: 'VillageMailbox.tsx', marker: 'KV_MOD_LEGAL', edits: [
    ["          { text: 'Illegal content', onPress: () => _note('illegal') },\n",
     "          { text: 'Illegal content', onPress: () => _note('illegal') },\n          { text: 'Legal request', onPress: () => _note('legal') }, // KV_MOD_LEGAL\n"],
    ["(RN.Alert as any).prompt('Evidence note (private)', 'Describe the evidence or file reference. Only its hash goes on chain.', [",
     "(RN.Alert as any).prompt(reason === 'legal' ? 'Legal request reference (private)' : 'Evidence note (private)', reason === 'legal' ? 'Agency + case or subpoena number. Only its hash goes on chain; keep the original document.' : 'Describe the evidence or file reference. Only its hash goes on chain.', ["],
  ] },
  { f: 'kaspa_payload.ts', marker: 'KV_MOD_OWNER_INFO', edits: [
    ["    const _dl = delistByTarget.get(String(record.d.storeAddress));\n    if (_dl && (_dl.o === owner || _dl.o === KV_MOD_PUBKEY) && (_dl.t || 0) > (record.t || 0)) continue;",
     `    const _dl = delistByTarget.get(String(record.d.storeAddress));
    // KV_MOD_OWNER_INFO: remember moderator removals so the owner is told why
    if (_dl && _dl.o === KV_MOD_PUBKEY && _dl.o !== owner && (_dl.t || 0) > (record.t || 0)) { try { const _g: any = globalThis as any; if (!_g.__kvFlagInfo) _g.__kvFlagInfo = new Map(); _g.__kvFlagInfo.set(String(record.d.storeAddress), { n: 0, reasons: [], owner: String(owner), name: String(record.d.name || ''), hidden: true, mod: true, modReason: String((_dl.d && _dl.d.reason) || 'unspecified') }); } catch {} }
    if (_dl && (_dl.o === owner || _dl.o === KV_MOD_PUBKEY) && (_dl.t || 0) > (record.t || 0)) continue;`],
  ] },
  { f: 'mailbox_kaspa_api.ts', marker: 'KV_MOD_OWNER_WARN', edits: [
    ["          const key = fi.n + (fi.hidden ? ':h' : '');",
     "          const key = fi.n + (fi.hidden ? ':h' : '') + (fi.mod ? ':m' : ''); // KV_MOD_OWNER_WARN"],
    ["          msgs.push(fi.hidden\n",
     "          msgs.push(fi.mod\n            ? '\"' + fi.name + '\" was removed by the moderator. Reason: ' + (fi.modReason === 'legal' ? 'legal request' : fi.modReason) + '. The reason and an evidence hash are public on the Kaspa chain.'\n            : fi.hidden\n"],
  ] },
];
let ok = true; const staged = [];
for (const j of jobs) {
  let s = fs.readFileSync(j.f, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
  if (s.includes(j.marker)) { console.log(j.f + ': already patched - skipping'); continue; }
  for (const [a] of j.edits) { const c = s.split(a).length - 1; if (c !== 1) { console.error(j.f + ' ANCHOR count ' + c + ' expected 1: ' + a.slice(0, 60)); ok = false; } }
  staged.push({ ...j, s, CRLF });
}
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const j of staged) { let s = j.s; for (const [a, b] of j.edits) s = s.split(a).join(b); fs.writeFileSync(j.f, j.CRLF ? s.replace(/\n/g, '\r\n') : s); console.log(j.f + ': patched'); }
console.log('DONE - Legal request lane + owners told when the moderator removes a listing.');
