// patch_daa_v2.cjs — timeoutN was computed as minutes*60, i.e. 1 DAA/sec.
// testnet-10 (and mainnet) target 10 blocks/sec, so every timeout was 10x too short:
// "7 minutes" was really 42 seconds, which no two-phone handshake can fit inside.
// Measured live: ~7.9 DAA/s (target 10; the shortfall is sampling noise + variance).
// Using the 10 target rather than the measurement — if the network runs slower than
// target the real wait is LONGER than asked, which errs in the buyer's favour.
//
// Also fixes the refund lockTime check. The old test was two-sided drift against
// currentDAA + N with 600 slack, which fails whenever the handshake takes longer than
// the slack — an artifact of the check, not a real problem. What actually matters:
//   (a) the lockTime is not already passed/imminent (seller could reclaim at once)
//   (b) it does not ask for materially longer than agreed
// The kill tx makes an early lockTime non-catastrophic anyway: if the seller's refund
// wins the race for A, the buyer's kill broadcast fails and the gate refuses to fund.
//
// v2: post-conditions are structural, not hand-counted (v1 miscounted substrings).
// Run: node patch_daa_v2.cjs
const fs = require('fs');

function occurrences(hay, needle){ let n = 0, i = 0; for(;;){ const j = hay.indexOf(needle, i); if (j < 0) break; n++; i = j + needle.length; } return n; }

const files = {};
function load(f){ files[f] = fs.readFileSync(f, 'utf8'); }
function replaceAll(f, name, a, r, expect){
  const n = occurrences(files[f], a);
  if (n !== expect) { console.error('ABORT ['+name+'] found '+n+', expected '+expect); process.exit(1); }
  files[f] = files[f].split(a).join(r);
  console.log('APPLIED ['+name+'] x'+n);
}
function mustHave(f, name, needle){
  if (occurrences(files[f], needle) < 1) { console.error('ABORT ['+name+'] missing: ' + needle); process.exit(1); }
}
function mustNotHave(f, name, needle){
  const n = occurrences(files[f], needle);
  if (n !== 0) { console.error('ABORT ['+name+'] still present x'+n+': ' + needle); process.exit(1); }
}

const NA = 'NeighborAgreement.tsx';
const CS = 'canonical_agreement_steps.ts';
load(NA); load(CS);

if (occurrences(files[NA], 'DAA_PER_MIN') !== 0) { console.error('ABORT: already applied'); process.exit(1); }

// ---- the constant ----
replaceAll(NA, 'constant',
"const FROST_ACTIVE_KEY = 'kv_frost_active_list';",
"// Kaspa targets 10 blocks/sec, so DAA advances ~10 per second — NOT 1.\r\n" +
"// Every timeout is expressed in DAA, so minutes must convert at 600, not 60.\r\n" +
"const DAA_PER_MIN = 600;\r\n" +
"const FROST_ACTIVE_KEY = 'kv_frost_active_list';",
1);

// ---- minutes -> DAA (5 sites: 5e poll guard, addToFrostList, proposeAgreement, proposal parts[13], 2c cosign) ----
replaceAll(NA, 'minutes->DAA',
"(contract.timeoutMinutes || 5) * 60",
"(contract.timeoutMinutes || 5) * DAA_PER_MIN",
5);

// ---- DAA -> minutes on resume (default 300 was 5 "min"; now 3000 DAA = 5 real min) ----
replaceAll(NA, 'resume DAA->min',
"Math.max(1, Math.round(Number(_p.timeoutN || 300) / 60))",
"Math.max(1, Math.round(Number(_p.timeoutN || 3000) / DAA_PER_MIN))",
1);

// ---- display: seller's "reclaim after X min" ----
replaceAll(NA, 'seller alert',
"(Number(_p.N) / 60)",
"(Number(_p.N) / DAA_PER_MIN)",
1);

// ---- display: 5d "opens in about X min" ----
replaceAll(NA, '5d countdown',
"Math.ceil(_rem / 60)",
"Math.ceil(_rem / DAA_PER_MIN)",
1);

// ---- refund lockTime check: correct semantics ----
const OLD = "  const lt = BigInt(template.lt || '0');\r\n" +
"  if (lt === 0n) return { valid: false, error: 'Refund has no lockTime — would be spendable immediately' };\r\n" +
"  const expectedLt = expected.currentDAA + expected.N;\r\n" +
"  const drift = lt > expectedLt ? lt - expectedLt : expectedLt - lt;\r\n" +
"  if (drift > slack) return { valid: false, error: 'lockTime ' + lt + ' does not match the agreed timeout (expected ~' + expectedLt + ')' };";
const NEW = "  const lt = BigInt(template.lt || '0');\r\n" +
"  if (lt === 0n) return { valid: false, error: 'Refund has no lockTime — would be spendable immediately' };\r\n" +
"  // (a) Must not already be spendable, or the seller could reclaim the instant they fund.\r\n" +
"  //     The seller stamps lt at accept; the buyer checks it minutes later, so lt is always\r\n" +
"  //     somewhat behind currentDAA + N. That drift is the handshake, not an attack — what\r\n" +
"  //     matters is only that real time remains on the clock.\r\n" +
"  const minRemaining = expected.minRemainingDAA ?? 600n;   // ~1 min at 10 DAA/s\r\n" +
"  if (lt < expected.currentDAA + minRemaining) {\r\n" +
"    return { valid: false, error: 'lockTime ' + lt + ' has passed or is about to (now ' + expected.currentDAA + '). The agreed timeout is too short for the time this handshake took — start again with a longer one.' };\r\n" +
"  }\r\n" +
"  // (b) Must not claim materially longer than agreed.\r\n" +
"  if (lt > expected.currentDAA + expected.N + slack) {\r\n" +
"    return { valid: false, error: 'lockTime ' + lt + ' is longer than the agreed timeout (max ' + (expected.currentDAA + expected.N + slack) + ')' };\r\n" +
"  }";
replaceAll(CS, 'lockTime check', OLD, NEW, 1);

// ---- the new optional field ----
replaceAll(CS, 'minRemaining field',
"    currentDAA: bigint;\r\n    slackDAA?: bigint;      // tolerance on lockTime (default 600 = 10 min)\r\n  },",
"    currentDAA: bigint;\r\n    slackDAA?: bigint;         // how much longer than N is tolerated (default 600 = ~1 min)\r\n    minRemainingDAA?: bigint;  // how much clock must still remain (default 600 = ~1 min)\r\n  },",
1);
replaceAll(CS, 'cosign sig',
"  expected: { predictedTxId: string; escrowScript: string; N: bigint; currentDAA: bigint; slackDAA?: bigint };",
"  expected: { predictedTxId: string; escrowScript: string; N: bigint; currentDAA: bigint; slackDAA?: bigint; minRemainingDAA?: bigint };",
1);

// ---- structural post-conditions ----
mustNotHave(NA, 'old minute conversion', "(contract.timeoutMinutes || 5) * 60");
mustNotHave(NA, 'old resume conversion', "Number(_p.timeoutN || 300) / 60");
mustNotHave(CS, 'old drift check', 'const drift = lt >');
mustHave(NA, 'constant declared', 'const DAA_PER_MIN = 600;');
mustHave(NA, '5e guard intact', '[5e-Guard] FROST-Poll BLOCKED');
mustHave(NA, 'kill gate intact', '[Kill-Gate] Kill broadcast:');
mustHave(NA, '2b intact', '[Refund] Funding tx FROZEN');
mustHave(CS, 'minRemaining used', 'if (lt < expected.currentDAA + minRemaining)');
mustHave(CS, 'upper bound used', 'if (lt > expected.currentDAA + expected.N + slack)');
mustHave(CS, 'kill verify intact', 'export function verifyKillTemplate');
console.log('Structural checks passed. DAA_PER_MIN refs: ' + occurrences(files[NA], 'DAA_PER_MIN'));

for (const f of [NA, CS]) { fs.writeFileSync(f, files[f]); console.log('WROTE ' + f); }
console.log('\nN is now real minutes. Use N >= 30 for two-phone testing —');
console.log('the lockTime is stamped when the seller ACCEPTS, so N must outlast the whole handshake.');
