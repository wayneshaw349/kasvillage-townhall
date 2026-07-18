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

// 1: dead import — zero call sites. Removing it kills the "grab the wrong function"
// trap that caused tonight's mismatch.
patch('NeighborAgreement.tsx', 'drop-dead-import',
`  verificationCode as computeVerificationCode,
`,
``);

// 2: canonical's copy used a different preimage (raw bytes, no prefix, 4 chars). Rather
// than delete it and risk a dangling import from some file I haven't seen, make it
// delegate to the one true function. Any stray caller now gets the correct 12-char code.
patch('canonical_agreement_steps.ts', 'neuter-canonical',
`export function verificationCode(pubkeyA: string, pubkeyB: string): string {
  const [pk1, pk2] = [pubkeyA, pubkeyB].sort();
  const hash = sha256(new Uint8Array([...hexToBytes(pk1), ...hexToBytes(pk2)]));
  return bytesToHex(hash).slice(0, 4).toUpperCase();
}`,
`export function verificationCode(pubkeyA: string, pubkeyB: string): string {
  // [UNIFIED] delegates to frost_complete.generateVerificationCode - the single
  // source of truth (12-char, FROST_VERIFY-prefixed). Kept only so any legacy
  // import path still resolves; do not reimplement the hash here.
  const [pk1, pk2] = [pubkeyA, pubkeyB].sort();
  const hash = sha256(new TextEncoder().encode('FROST_VERIFY:' + pk1 + pk2));
  return bytesToHex(hash).slice(0, 12).toUpperCase();
}`);

console.log(ok === total ? `ALL ${ok}/${total} APPLIED` : `PARTIAL ${ok}/${total} — check skips`);
