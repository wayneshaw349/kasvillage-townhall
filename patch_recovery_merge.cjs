const fs = require('fs');
const F = 'NeighborAgreement.tsx';
let s = fs.readFileSync(F, 'utf8');
let ok = 0, total = 0;

function sub(tag, needle, repl) {
  total++;
  const n = s.split(needle).length - 1;
  if (n !== 1) { console.log(`SKIP [${tag}] count = ${n}, expected 1`); return; }
  s = s.replace(needle, repl);
  console.log(`APPLIED [${tag}]`);
  ok++;
}

// 1: drop the "only if the list is empty" gate. One surviving entry was enough to
// hide every other agreement from recovery forever.
sub('recovery-ungate',
`if (allActive.length === 0) {`,
`if (true) { // [RECOVERY-MERGE] always scan - a non-empty list must not mask a missing agrId`);

// 2: merge, don't duplicate. A local entry always wins: it carries timeoutN and the
// nonce references that Arweave has no record of.
sub('recovery-dedupe',
`const agrId = a.agreementId || a.agreement_id || '';`,
`const agrId = a.agreementId || a.agreement_id || ''; if (agrId && allActive.some(e => e.agrId === agrId)) continue; // [RECOVERY-MERGE] local entry wins`);

// 3: the old log counted the whole list, which now includes local entries.
sub('recovery-log',
`if (allActive.length > 0) console.log('[Recovery] Found', allActive.length, 'agreements from Arweave');`,
`console.log('[Recovery] Arweave scan complete - list now', allActive.length, 'entries');`);

// post-conditions
const checks = [
  [`if (allActive.length === 0) {`, 0],
  [`[RECOVERY-MERGE]`, 2],
  [`allActive.some(e => e.agrId === agrId)`, 1],
];
for (const [needle, want] of checks) {
  const n = s.split(needle).length - 1;
  if (n !== want) { console.log(`ABORT post-condition "${needle}" = ${n}, want ${want}`); process.exit(1); }
}

if (ok !== total) { console.log(`ABORT - ${ok}/${total} applied, file NOT written`); process.exit(1); }
fs.writeFileSync(F, s);
console.log(`WROTE ${F} (${ok}/${total})`);
