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

// 1: THE BUG. With amounts 0/0 (Arweave record had no KV-BuyerAmount tag), the test
// eBal >= 0 is always true, so every recovered entry silently became "fully funded"
// and crash-recovery skipped it at its first line. Zero total means unknown, not met.
sub('step-bump-zero-guard',
`updatedList.push({ ...entry, step: eBal >= (entry.buyerAmount + entry.sellerAmount) ? 4 : entry.step });`,
`const _eTotal = entry.buyerAmount + entry.sellerAmount;
              const _eStep = (_eTotal > 0 && eBal >= _eTotal) ? 4 : entry.step;
              if (_eTotal <= 0) console.warn('[Background-FROST] ' + entry.agrId.slice(0,12) + ' has no amounts (buyer=' + entry.buyerAmount + ' seller=' + entry.sellerAmount + ') - cannot fund, step left at ' + entry.step);
              updatedList.push({ ...entry, step: _eStep });`);

// 2: the log printed the PRE-update step, so an entry bumped to 4 still read "step: 3".
sub('polling-log-true-step',
`console.log('[Background-FROST] Polling', entry.agrId.slice(0,12), ':', eBal, 'KAS', 'step:', entry.step);`,
`console.log('[Background-FROST] Polling', entry.agrId.slice(0,12), ':', eBal, 'KAS', 'role:', entry.role, 'want:', entry.buyerAmount, '+', entry.sellerAmount);`);

// 3-5: three silent continues. Every one of them can drop a funded agreement on the
// floor with no trace, which is exactly what happened here.
sub('cr-log-step',
`          if (entry.step >= 4) continue; // already fully funded`,
`          if (entry.step >= 4) { console.log('[Crash-Recovery] skip', entry.agrId.slice(0,12), '- step', entry.step, '(already funded)'); continue; }`);

sub('cr-log-role',
`          if (entry.role !== 'buyer') continue; // only buyer auto-sends from recovery`,
`          if (entry.role !== 'buyer') { console.log('[Crash-Recovery] skip', entry.agrId.slice(0,12), '- role is', entry.role, '(only buyer auto-sends)'); continue; }`);

sub('cr-log-amounts',
`          if (expectedBuyer <= 0 || expectedSeller <= 0) continue;`,
`          if (expectedBuyer <= 0 || expectedSeller <= 0) { console.warn('[Crash-Recovery] skip', entry.agrId.slice(0,12), '- amounts unknown: buyer=', expectedBuyer, 'seller=', expectedSeller); continue; }`);

// post-conditions
const checks = [
  [`step: eBal >= (entry.buyerAmount + entry.sellerAmount) ? 4 : entry.step`, 0],
  [`_eTotal > 0 && eBal >= _eTotal`, 1],
  [`[Crash-Recovery] skip`, 3],
];
for (const [needle, want] of checks) {
  const n = s.split(needle).length - 1;
  if (n !== want) { console.log(`ABORT post-condition "${needle}" = ${n}, want ${want}`); process.exit(1); }
}

if (ok !== total) { console.log(`ABORT - ${ok}/${total} applied, file NOT written`); process.exit(1); }
fs.writeFileSync(F, s);
console.log(`WROTE ${F} (${ok}/${total})`);
