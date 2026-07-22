const fs = require('fs');
const F = 'frost_complete.ts';
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

// Leaves of the RETIRED deterministic-nonce signer. Every other dead function reaches
// key material through these. Live ceremony is in canonical_agreement_steps.ts (random
// k per input, L1-validated). A throw turns a silent deterministic-nonce sign — the
// cross-session key-leak footgun — into a loud, caught refusal at every stale call site.

sub('neuter-createPartialSigLocal',
`  const { frostAddress, recipientAddress, amountSompi, privateKeyHex, recipients } = params;
  const N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');`,
`  const { frostAddress, recipientAddress, amountSompi, privateKeyHex, recipients } = params;
  throw new Error('[RETIRED] createPartialSigLocal (deterministic-nonce signer) - use canonical_agreement_steps ceremony');
  // eslint-disable-next-line no-unreachable
  const N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');`);

sub('neuter-computeFrostPartialS',
`  const N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
  const { myNonce, counterpartyR_hex, frostAddress } = params;`,
`  throw new Error('[RETIRED] computeFrostPartialS (deterministic-nonce signer) - use canonical_agreement_steps ceremony');
  // eslint-disable-next-line no-unreachable
  const N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
  const { myNonce, counterpartyR_hex, frostAddress } = params;`);

const checks = [
  [`[RETIRED] createPartialSigLocal`, 1],
  [`[RETIRED] computeFrostPartialS`, 1],
];
for (const [needle, want] of checks) {
  const n = s.split(needle).length - 1;
  if (n !== want) { console.log(`ABORT post-condition "${needle}" = ${n}, want ${want}`); process.exit(1); }
}

if (ok !== total) { console.log(`ABORT - ${ok}/${total} applied, file NOT written`); process.exit(1); }
fs.writeFileSync(F, s);
console.log(`WROTE ${F} (${ok}/${total})`);
