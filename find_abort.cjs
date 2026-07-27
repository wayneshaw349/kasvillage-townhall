// find_abort.cjs — dump the exact abort-path source lines (untrimmed) + hex head
// Run: node find_abort.cjs
const s = require('fs').readFileSync('NeighborAgreement.tsx', 'utf8').split(/\r?\n/);
s.forEach((l, n) => {
  if (/Released UTXO tags|releaseCommitment/.test(l)) {
    console.log('--- line ' + (n + 1) + ' ---');
    console.log('RAW: [' + l + ']');
    // show leading whitespace + first 40 chars as hex so quote/indent style is visible
    const head = l.slice(0, 60);
    console.log('HEX: ' + Buffer.from(head, 'utf8').toString('hex'));
    console.log('');
  }
});
