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

// Group into 4-char blocks so two people can read 12 chars aloud without losing place.
// .replace on a possibly-undefined code is guarded with (code || '').

// Site 1: the VerificationCodeDisplay component (step 3 confirm gate).
sub('display-component',
`      <Text style={verifyStyles.code}>{code}</Text>`,
`      <Text style={verifyStyles.code}>{(code || '').replace(/(.{4})(?=.)/g, '$1-')}</Text>`);

// Site 2: the "Share with Counterparty" card.
sub('display-sharecard',
`fontWeight: '900', color: '#312e81', letterSpacing: 6, textAlign: 'center' }}>{contract.verificationCode}</Text>`,
`fontWeight: '900', color: '#312e81', letterSpacing: 4, textAlign: 'center' }}>{(contract.verificationCode || '').replace(/(.{4})(?=.)/g, '$1-')}</Text>`);

if (ok !== total) { console.log(`ABORT - ${ok}/${total} applied, file NOT written`); process.exit(1); }
fs.writeFileSync(F, s);
console.log(`WROTE ${F} (${ok}/${total})`);
