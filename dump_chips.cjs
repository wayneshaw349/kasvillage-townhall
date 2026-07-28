const s = require('fs').readFileSync('NeighborAgreement.tsx', 'utf8').split(/\r?\n/);
const i = s.findIndex(l => l.indexOf("'recent',l:'Recent'") >= 0);
if (i < 0) { console.log('NOT FOUND — recent chip line missing'); process.exit(0); }
for (let j = i - 3; j <= i + 6; j++) {
  console.log((j + 1) + ': [' + s[j] + ']');
  if (s[j] && s[j].indexOf('Recent') >= 0) console.log('   HEX: ' + Buffer.from(s[j], 'utf8').toString('hex'));
}
