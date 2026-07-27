// dump_apostrophe.cjs — show raw text + hex of the two failing title lines
// Run: node dump_apostrophe.cjs
const s = require('fs').readFileSync('NeighborAgreement.tsx', 'utf8').split(/\r?\n/);
[4046, 4163].forEach(n => {
  const l = s[n - 1] || '';
  console.log(n + ': [' + l.trim().slice(0, 140) + ']');
  const i = l.indexOf('Paste');
  if (i >= 0) {
    const seg = l.slice(i, i + 45);
    console.log('   HEX: ' + Buffer.from(seg, 'utf8').toString('hex'));
  }
});
// also search nearby lines in case insertions shifted the numbers
console.log('--- search by content ---');
s.forEach((l, n) => {
  if (/Refund Template<\/Text>|Refund Sign<\/Text>/.test(l)) {
    console.log((n + 1) + ': [' + l.trim().slice(0, 140) + ']');
    const i = l.indexOf('Paste');
    if (i >= 0) console.log('   HEX: ' + Buffer.from(l.slice(i, i + 45), 'utf8').toString('hex'));
  }
});
