const fs = require('fs');
const F = 'kv_proposal.ts';
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

// The three old lines each appear once and are individually unique. Replace the
// expectedCode computation, then swap the non-blocking log for a blocking gate.
sub('drop-sorted',
`  const sorted = [proposal.buyerPubkey, proposal.sellerPubkey].sort();`,
`  // [MITM-GATE] one function, shared with the displayed code.`);

sub('drop-codehash',
`  const codeHash = sha256(new TextEncoder().encode(sorted[0] + sorted[1]));`,
``);

sub('swap-expectedcode',
`  const expectedCode = bytesToHex(codeHash.slice(0, 2)).toUpperCase();`,
`  const expectedCode = generateVerificationCode(proposal.buyerPubkey as string, proposal.sellerPubkey as string);`);

sub('block-on-mismatch',
`    console.log('[KV] code recompute differs (signature is the gate, non-blocking):', expectedCode, 'vs', proposal.verificationCode);`,
`    proposal.valid = false;
    proposal.error = 'Verification code mismatch — pubkeys may have been swapped in transit. Do not proceed.';
    console.warn('[KV] CODE MISMATCH (blocking):', expectedCode, 'vs', proposal.verificationCode);
    return proposal;`);

// The guard `if (proposal.verificationCode !== expectedCode)` stays as-is and now
// wraps the blocking body. Only fire when a code was actually supplied.
sub('guard-empty-tolerant',
`  if (proposal.verificationCode !== expectedCode) {`,
`  if (proposal.verificationCode && proposal.verificationCode !== expectedCode) {`);

// post-conditions: old preimage gone, new function referenced, gate present
const checks = [
  [`codeHash.slice(0, 2)`, 0],
  [`sorted[0] + sorted[1]`, 0],
  [`generateVerificationCode(proposal.buyerPubkey`, 1],
  [`CODE MISMATCH (blocking)`, 1],
];
for (const [needle, want] of checks) {
  const n = s.split(needle).length - 1;
  if (n !== want) { console.log(`ABORT post-condition "${needle}" = ${n}, want ${want}`); process.exit(1); }
}

if (ok !== total) { console.log(`ABORT - ${ok}/${total} applied, file NOT written`); process.exit(1); }
fs.writeFileSync(F, s);
console.log(`WROTE ${F} (${ok}/${total})`);
