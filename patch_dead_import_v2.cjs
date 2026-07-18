const fs = require('fs');
let ok = 0, total = 0;

function patch(file, tag, needle, repl) {
  total++;
  let s = fs.readFileSync(file, 'utf8');
  const n = s.split(needle).length - 1;
  if (n !== 1) { console.log(`SKIP [${tag}] count = ${n}, expected 1 in ${file}`); return; }
  s = s.replace(needle, repl);
  fs.writeFileSync(file, s);
  console.log(`APPLIED [${tag}]`);
  ok++;
}

// 1: dead import line - single line, no embedded newline in the needle. Replace the
// alias with an empty import slot (leaves a blank named-import line, harmless).
patch('NeighborAgreement.tsx', 'drop-dead-import',
`  verificationCode as computeVerificationCode,`,
`  // [REMOVED] verificationCode alias - use generateVerificationCode from frost_complete`);

// 2: canonical's hash line - only the slice line is unique enough and single-line.
// Bump 4->12 and switch preimage to the prefixed UTF-8 form so it matches the source
// of truth. Two edits, both single-line.
patch('canonical_agreement_steps.ts', 'canonical-preimage',
`  const hash = sha256(new Uint8Array([...hexToBytes(pk1), ...hexToBytes(pk2)]));`,
`  const hash = sha256(new TextEncoder().encode('FROST_VERIFY:' + pk1 + pk2)); // [UNIFIED] match frost_complete`);

patch('canonical_agreement_steps.ts', 'canonical-slice',
`  return bytesToHex(hash).slice(0, 4).toUpperCase();`,
`  return bytesToHex(hash).slice(0, 12).toUpperCase();`);

console.log(ok === total ? `ALL ${ok}/${total} APPLIED` : `PARTIAL ${ok}/${total} — check skips`);
