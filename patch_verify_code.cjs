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

// 1: the single source of truth. 12 hex chars = 48 bits (~years to grind a colliding
// pubkey). Prefix domain-separates so it can't collide another sha256 in the system.
patch('frost_complete.ts', 'canonical-12char',
`  return bytesToHex(hash).slice(0, 4).toUpperCase();`,
`  return bytesToHex(hash).slice(0, 12).toUpperCase(); // 48-bit MITM grind cost`);

// 2: kv_proposal recomputed with a DIFFERENT preimage (no prefix, 4 chars), so the
// check could never pass even with no attacker - users learned to ignore it. Same
// function now, and it BLOCKS: a mismatch means the pubkeys were swapped in transit.
patch('kv_proposal.ts', 'kvproposal-import',
`import { sha256 } from '@noble/hashes/sha256';`,
`import { sha256 } from '@noble/hashes/sha256';
import { generateVerificationCode } from './frost_complete';`);

patch('kv_proposal.ts', 'kvproposal-use-canonical',
`  // Verify code
  const sorted = [proposal.buyerPubkey, proposal.sellerPubkey].sort();
  const codeHash = sha256(new TextEncoder().encode(sorted[0] + sorted[1]));
  const expectedCode = bytesToHex(codeHash.slice(0, 2)).toUpperCase();
  if (proposal.verificationCode !== expectedCode) {
    console.log('[KV] code recompute differs (signature is the gate, non-blocking):', expectedCode, 'vs', proposal.verificationCode);
  }`,
`  // Verify code — one function, shared with the displayed code. A mismatch here
  // means the pubkeys differ from what the buyer signed over: MITM pubkey swap.
  const expectedCode = generateVerificationCode(proposal.buyerPubkey as string, proposal.sellerPubkey as string);
  if (proposal.verificationCode && proposal.verificationCode !== expectedCode) {
    proposal.valid = false;
    proposal.error = 'Verification code mismatch — pubkeys may have been swapped in transit. Do not proceed.';
    console.warn('[KV] CODE MISMATCH (blocking):', expectedCode, 'vs', proposal.verificationCode);
    return proposal;
  }`);

console.log(ok === total ? `ALL ${ok}/${total} APPLIED` : `PARTIAL ${ok}/${total} — check skips`);
