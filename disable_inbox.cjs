const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let s = fs.readFileSync(f, 'utf8');
let report = [];

// EDIT 1: kill Active-list auto-populate (the "Populating 14 active agreements" stale scan)
const a = 'setFrostActiveList(arweaveEntries);';
const aFix = 'if (false) setFrostActiveList(arweaveEntries); /* KV: active-list populate disabled, paste-only */';
const aN = s.split(a).length - 1;
if (aN === 1) { s = s.split(a).join(aFix); report.push('EDIT1 active-list: disabled (1)'); }
else { report.push('EDIT1 active-list: SKIPPED, found ' + aN + ' (expected 1)'); }

// EDIT 2: kill inbox population (both TownHall + Arweave) -> Accept cards never appear
const b = 'return newOnes.length > 0 ? [...prev, ...newOnes] : prev;';
const bFix = 'return prev; /* KV: inbox disabled, paste-only */';
const bN = s.split(b).length - 1;
if (bN === 2) { s = s.split(b).join(bFix); report.push('EDIT2 inbox: disabled (2)'); }
else { report.push('EDIT2 inbox: SKIPPED, found ' + bN + ' (expected 2)'); }

if (report.every(r => r.includes('disabled'))) {
  fs.writeFileSync(f, s);
  console.log('WROTE FILE');
} else {
  console.log('NO WRITE (a count was off)');
}
report.forEach(r => console.log('  ' + r));
