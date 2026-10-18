// fix_grant_pubkey_wording.cjs — "KasVillage ID" -> "pubkey" in the grant + contact flow.
const fs = require('fs');
const jobs = [
  { f: 'Workspace.tsx', swaps: [
    ['Grant - buyer ID', 'Grant - buyer pubkey'],
    ['KasVillage ID (from their message).', 'pubkey (from their message: 66 hex, starts 02 or 03).'],
    ["'Bad ID', 'A KasVillage ID is 66 hex", "'Bad pubkey', 'A pubkey is 66 hex"],
  ] },
  { f: 'VillageMailbox.tsx', swaps: [
    ['My KasVillage ID: ', 'My pubkey: '],
    ['with your KasVillage ID is copied', 'with your pubkey is copied'],
  ] },
];
let ok = true; const staged = [];
for (const j of jobs) {
  let s = fs.readFileSync(j.f, 'utf8');
  if (!s.includes('KasVillage ID') && !s.includes('Grant - buyer ID')) { console.log(j.f + ': already patched - skipping'); continue; }
  for (const [a] of j.swaps) { const c = s.split(a).length - 1; if (c !== 1) { console.error(j.f + ' count ' + c + ' expected 1: ' + a); ok = false; } }
  staged.push({ ...j, s });
}
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const j of staged) { let s = j.s; for (const [a, b] of j.swaps) s = s.split(a).join(b); fs.writeFileSync(j.f, s); console.log(j.f + ': patched'); }
console.log('DONE - grant flow says pubkey.');
