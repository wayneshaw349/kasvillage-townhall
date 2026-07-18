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

// The funder pays the network fee out of their own send, so the escrow receives
// amount-minus-fee. A 6 KAS collateral lands as 5.99832. Any gate that demands the
// exact declared sum can never be satisfied and the agreement is stuck at step 3
// forever with the money already locked. 5% covers the fee without letting a
// materially short deposit through - and in FROST-Poll the real check is the
// per-amount +/-5% match below it, not this sum.
sub('merge-step-fee-tolerance',
`const _eStep = (_eTotal > 0 && eBal >= _eTotal) ? 4 : entry.step;`,
`const _eStep = (_eTotal > 0 && eBal >= _eTotal * 0.95) ? 4 : entry.step;`);

sub('poll-total-fee-tolerance',
`        if (balance >= expectedTotal && expectedTotal > 0) {`,
`        if (balance >= expectedTotal * 0.95 && expectedTotal > 0) {`);

// post-conditions
const checks = [
  [`eBal >= _eTotal * 0.95`, 1],
  [`balance >= expectedTotal * 0.95`, 1],
  [`eBal >= _eTotal)`, 0],
];
for (const [needle, want] of checks) {
  const n = s.split(needle).length - 1;
  if (n !== want) { console.log(`ABORT post-condition "${needle}" = ${n}, want ${want}`); process.exit(1); }
}

if (ok !== total) { console.log(`ABORT - ${ok}/${total} applied, file NOT written`); process.exit(1); }
fs.writeFileSync(F, s);
console.log(`WROTE ${F} (${ok}/${total})`);
