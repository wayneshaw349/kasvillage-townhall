// patch_kill_a.cjs — kill tx crypto (build / verify / cosign)
//
// The kill tx spends the seller's predicted escrow UTXO A and pays it straight back
// to the SAME FROST address. Nobody gets paid; the money never leaves escrow. The
// point is only that A is consumed — which makes the refund (whose sole input is A)
// permanently unbroadcastable. "Escrow fully funded" and "refund dead" become the
// same event, enforced by consensus rather than by a UI check.
//
// Deliberately does NOT extend computeReleaseOutputs: that switch is shared with
// release and cancel, and adding a mode means threading an escrowScript param
// through every caller. Builds its template directly instead.
//
// Run: node patch_kill_a.cjs
const fs = require('fs');

const F = 'canonical_agreement_steps.ts';
let s = fs.readFileSync(F, 'utf8');

function occurrences(hay, needle){ let n = 0, i = 0; for(;;){ const j = hay.indexOf(needle, i); if (j < 0) break; n++; i = j + needle.length; } return n; }
function requireCount(name, needle, expect){
  const n = occurrences(s, needle);
  if (n !== expect) { console.error('ABORT ['+name+'] found '+n+', expected '+expect); process.exit(1); }
  console.log('OK ['+name+'] count='+n);
}

const ANCHOR = "// ============================================================================\r\n// SECTION 9: AGR ID (deterministic from pubkeys + amounts + UTXO tag)";
const ANCHOR_LF = "// ============================================================================\n// SECTION 9: AGR ID (deterministic from pubkeys + amounts + UTXO tag)";
let anchor = ANCHOR;
if (occurrences(s, ANCHOR) === 0) { anchor = ANCHOR_LF; }
requireCount('SECTION 9 anchor', anchor, 1);
requireCount('cosignRefundTemplate present', 'export function cosignRefundTemplate', 1);
requireCount('buildKillTx absent', 'export function buildKillTx', 0);

const BLOCK =
"// ============================================================================\r\n" +
"// SECTION 8c: KILL TX\r\n" +
"// Spends the seller's predicted escrow UTXO A and pays it back to the SAME FROST\r\n" +
"// address. No lockTime. Nobody is paid — A simply stops existing, which kills the\r\n" +
"// refund (whose only input is A) by consensus, not by a guard.\r\n" +
"//\r\n" +
"// The seller pre-signs this at accept as the price of the buyer co-signing the\r\n" +
"// refund. Withholding it gains the seller nothing: the buyer then never funds, and\r\n" +
"// the seller's collateral just sits until they reclaim it at N.\r\n" +
"//\r\n" +
"// Why this is safe to hand over: the tx can only move A from escrow back to escrow.\r\n" +
"// It cannot pay anyone, so publishing it costs nothing.\r\n" +
"// ============================================================================\r\n" +
"export function buildKillTx(params: {\r\n" +
"  sellerPrivKeyHex: string;\r\n" +
"  sellerPubkey: string;\r\n" +
"  buyerPubkey: string;\r\n" +
"  counter: number;\r\n" +
"  predictedEscrowUtxo: { txId: string; index: number; amount: string; scriptPubKey: string };\r\n" +
"  agrId: string;\r\n" +
"  fee?: bigint;\r\n" +
"}): { template: TxTemplate; templateB64: string; nonce: FrostNonce; sighashes: string[] } {\r\n" +
"  const u = params.predictedEscrowUtxo;\r\n" +
"  const fee = params.fee || BigInt(1 * 115000 + 1 * 48000 + 5000);\r\n" +
"  const totalIn = BigInt(u.amount);\r\n" +
"  if (totalIn <= fee) throw new Error('Kill: escrow amount too low for fee');\r\n" +
"\r\n" +
"  // Fresh random k, same as every other ceremony call. NEVER derive k from the tx:\r\n" +
"  // the refund and the kill spend the SAME utxo with DIFFERENT outputs, so a shared\r\n" +
"  // k across the two would give d = (s1-s2)/(e1-e2) — the wallet key by division.\r\n" +
"  const nonce = generateNonce(params.sellerPrivKeyHex, params.sellerPubkey, params.buyerPubkey, params.counter);\r\n" +
"\r\n" +
"  const template: TxTemplate = {\r\n" +
"    u: [{ t: u.txId, i: u.index, a: u.amount, s: u.scriptPubKey }],\r\n" +
"    o: [{ v: (totalIn - fee).toString(), s: u.scriptPubKey }],  // back to the escrow\r\n" +
"    f: fee.toString(),\r\n" +
"    R: nonce.R_hex,\r\n" +
"    agr: params.agrId,\r\n" +
"    lt: '0',                                                    // spendable immediately\r\n" +
"  };\r\n" +
"\r\n" +
"  const inputs: CanonicalInput[] = template.u.map((x) => ({ txId: x.t, index: x.i, value: BigInt(x.a), scriptPubKey: x.s }));\r\n" +
"  const outputs: CanonicalOutput[] = template.o.map((o) => ({ value: BigInt(o.v), script: o.s }));\r\n" +
"  const sighashes: string[] = [];\r\n" +
"  for (let i = 0; i < inputs.length; i++) sighashes.push(bytesToHex(computeSighash(inputs, outputs, i, 0n)));\r\n" +
"\r\n" +
"  return { template, templateB64: encodeTemplate(template), nonce, sighashes };\r\n" +
"}\r\n" +
"\r\n" +
"/** Buyer's check before co-signing the kill tx. It must only ever move A escrow->escrow. */\r\n" +
"export function verifyKillTemplate(\r\n" +
"  template: TxTemplate,\r\n" +
"  expected: { predictedTxId: string; escrowScript: string },\r\n" +
"): { valid: boolean; error?: string } {\r\n" +
"  if (template.u.length !== 1) return { valid: false, error: 'Kill must spend exactly 1 input, saw ' + template.u.length };\r\n" +
"  const u = template.u[0];\r\n" +
"  if (u.t !== expected.predictedTxId) return { valid: false, error: 'Kill input is not the predicted escrow txid' };\r\n" +
"  if (u.i !== 0) return { valid: false, error: 'Kill input index must be 0, saw ' + u.i };\r\n" +
"  if (u.s !== expected.escrowScript) return { valid: false, error: 'Kill input script is not the FROST escrow script' };\r\n" +
"\r\n" +
"  if (template.o.length !== 1) return { valid: false, error: 'Kill must have exactly 1 output, saw ' + template.o.length };\r\n" +
"  // THE point of the whole tx: the output goes back to escrow, not to a party.\r\n" +
"  if (template.o[0].s !== expected.escrowScript) return { valid: false, error: 'Kill output does not return to the escrow — it pays someone' };\r\n" +
"  if (!isPureP2PK(template.o[0].s)) return { valid: false, error: 'Kill output is not standard P2PK' };\r\n" +
"\r\n" +
"  if (BigInt(template.lt || '0') !== 0n) return { valid: false, error: 'Kill must have no lockTime — it has to be broadcastable at once' };\r\n" +
"\r\n" +
"  const totalIn = BigInt(u.a);\r\n" +
"  const totalOut = BigInt(template.o[0].v);\r\n" +
"  const fee = BigInt(template.f);\r\n" +
"  if (totalOut + fee > totalIn) return { valid: false, error: 'Inflation: output + fee exceed input' };\r\n" +
"  const minFee = BigInt(template.u.length * 115000 + template.o.length * 48000 + 5000);\r\n" +
"  if (fee < minFee) return { valid: false, error: 'Fee too low: ' + fee + ' < ' + minFee };\r\n" +
"\r\n" +
"  return { valid: true };\r\n" +
"}\r\n" +
"\r\n" +
"/** Buyer co-signs the kill tx. k born and dies here. */\r\n" +
"export function cosignKillTemplate(params: {\r\n" +
"  privateKeyHex: string;\r\n" +
"  myPubkey: string;        // co-signer (buyer)\r\n" +
"  funderPubkey: string;    // seller — whose UTXO is being consumed\r\n" +
"  counter: number;\r\n" +
"  template: TxTemplate;\r\n" +
"  expected: { predictedTxId: string; escrowScript: string };\r\n" +
"}): { response: SellerResponse; responseB64: string } | { error: string } {\r\n" +
"  const { privateKeyHex, myPubkey, funderPubkey, counter, template } = params;\r\n" +
"\r\n" +
"  const v = verifyKillTemplate(template, params.expected);\r\n" +
"  if (!v.valid) return { error: v.error || 'Kill verification failed' };\r\n" +
"\r\n" +
"  // Same party mapping as buildSellerRefund/buildKillTx: funder in the buyerPubkey\r\n" +
"  // slot. deriveAggregateKey and generateNonce both sort internally, so the slot\r\n" +
"  // choice does not move the aggregate key.\r\n" +
"  const agg = deriveAggregateKey(funderPubkey, myPubkey, counter);\r\n" +
"  const nonce = generateNonce(privateKeyHex, funderPubkey, myPubkey, counter);\r\n" +
"\r\n" +
"  const inputs: CanonicalInput[] = template.u.map((u) => ({ txId: u.t, index: u.i, value: BigInt(u.a), scriptPubKey: u.s }));\r\n" +
"  const outputs: CanonicalOutput[] = template.o.map((o) => ({ value: BigInt(o.v), script: o.s }));\r\n" +
"\r\n" +
"  const partials: string[] = [];\r\n" +
"  for (let i = 0; i < inputs.length; i++) {\r\n" +
"    const shHex = bytesToHex(computeSighash(inputs, outputs, i, 0n));\r\n" +
"    partials.push(partialSign(nonce, template.R, agg.aggXOnly, shHex).s_hex);\r\n" +
"  }\r\n" +
"\r\n" +
"  const response: SellerResponse = { R: nonce.R_hex, s: partials };\r\n" +
"  return { response, responseB64: encodeResponse(response) };\r\n" +
"}\r\n" +
"\r\n";

const i = s.indexOf(anchor);
s = s.slice(0, i) + BLOCK + s.slice(i);

if (occurrences(s, 'export function buildKillTx') !== 1) { console.error('ABORT: buildKillTx missing after splice'); process.exit(1); }
if (occurrences(s, 'export function verifyKillTemplate') !== 1) { console.error('ABORT: verifyKillTemplate missing'); process.exit(1); }
if (occurrences(s, 'export function cosignKillTemplate') !== 1) { console.error('ABORT: cosignKillTemplate missing'); process.exit(1); }
if (occurrences(s, 'export function cosignRefundTemplate') !== 1) { console.error('ABORT: refund cosign clobbered'); process.exit(1); }
if (occurrences(s, 'export function buildSellerRefund') !== 1) { console.error('ABORT: buildSellerRefund clobbered'); process.exit(1); }

fs.writeFileSync(F, s);
console.log('WROTE ' + F + ' (+' + BLOCK.length + ' bytes)');
