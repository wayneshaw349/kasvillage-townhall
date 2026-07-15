// patch_p2a_fix.cjs — re-applies K3/K4/C1 which silently no-opped in patch_p2a.cjs
// (they were called with 3 args instead of 4, so the replacement was `undefined`)
// K1/K2 already applied — this asserts that and does not touch them.
// Run: node patch_p2a_fix.cjs
const fs = require('fs');

function esc(x){ return x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function rx(a){ return new RegExp(esc(a).replace(/\n/g, '\\r?\\n'), 'g'); }

const files = {};
function load(f){ files[f] = fs.readFileSync(f, 'utf8'); }
function count(f, a){ return (files[f].match(rx(a)) || []).length; }
function guard(f, name, a, expect){
  const c = count(f, a);
  if (c !== expect) { console.error('ABORT ['+name+'] '+f+' count='+c+' expected='+expect); process.exit(1); }
  console.log('OK ['+name+'] '+f+' count='+c);
}
// sub with POST-CONDITION: verifies the file actually changed and the marker landed.
function sub(f, name, a, r, marker){
  if (typeof r !== 'string') { console.error('ABORT ['+name+'] replacement is not a string'); process.exit(1); }
  const before = files[f];
  files[f] = before.replace(rx(a), () => r);
  if (files[f] === before) { console.error('ABORT ['+name+'] replace was a NO-OP'); process.exit(1); }
  if (marker && files[f].indexOf(marker) < 0) { console.error('ABORT ['+name+'] marker not found after replace: ' + marker); process.exit(1); }
  console.log('APPLIED ['+name+'] +' + (files[f].length - before.length) + ' bytes');
}

const KT = 'kaspa_rest_tx.ts';
const CS = 'canonical_agreement_steps.ts';
load(KT); load(CS);

// --- sanity: K1/K2 from patch_p2a must already be in place ---
guard(KT, 'PRE K1 applied', "  predictedTxId?: string;   // set when prepareOnly — the frozen tx's id", 1);
guard(KT, 'PRE K2 applied', "  prepareOnly?: boolean;    // freeze + predict txid, do NOT broadcast", 1);
// --- sanity: K3/K4/C1 must NOT be present ---
guard(KT, 'PRE K3 absent', "if (params.prepareOnly) {", 0);
guard(KT, 'PRE K4 absent', "export async function broadcastPreparedTx", 0);
guard(CS, 'PRE C1 absent', "export function cosignRefundTemplate", 0);

// ================= K3: prepareOnly early return =================
const K3 = "      console.log('[REST-TX] PREDICTED txid:', _predictedTxId, '| escrow outpoint =', _predictedTxId + ':0');\n    } catch (e) { console.warn('[REST-TX] txid prediction failed (non-fatal):', e); }";
guard(KT,'K3 checkpoint',K3,1);
sub(KT,'K3',K3, K3 + "\r\n" +
"    // FREEZE POINT — return the signed-but-unbroadcast tx + its predicted id\r\n" +
"    if (params.prepareOnly) {\r\n" +
"      if (!_predictedTxId) return { success: false, error: 'txid prediction failed — cannot prepare refund' };\r\n" +
"      console.log('[REST-TX] PREPARE-ONLY — frozen, not broadcast. txid:', _predictedTxId);\r\n" +
"      return { success: true, predictedTxId: _predictedTxId, preparedTx: tx };\r\n" +
"    }",
"if (params.prepareOnly) {");

// ================= K4: broadcastPreparedTx =================
const K4 = "// ============================================================================\n// INSCRIBE IDENTITY VIA REST\n// ============================================================================";
guard(KT,'K4 anchor',K4,1);
sub(KT,'K4',K4,
"// ============================================================================\r\n" +
"// BROADCAST A PREPARED (FROZEN) TX — the body must be byte-identical to the one\r\n" +
"// whose txid was predicted, or the refund points at a UTXO that never exists.\r\n" +
"// ============================================================================\r\n" +
"export async function broadcastPreparedTx(tx: any, network: KaspaNetwork): Promise<RestTxResult> {\r\n" +
"  try {\r\n" +
"    const submitResp = await fetch(`${API_BASES[network]}/transactions`, {\r\n" +
"      method: 'POST',\r\n" +
"      headers: { 'Content-Type': 'application/json' },\r\n" +
"      body: JSON.stringify({ transaction: tx, allowOrphan: false }),\r\n" +
"    });\r\n" +
"    if (!submitResp.ok) {\r\n" +
"      const errBody = await submitResp.text();\r\n" +
"      console.error('[REST-TX] Prepared submit FAILED:', submitResp.status, errBody);\r\n" +
"      return { success: false, error: `Submit failed (${submitResp.status}): ${errBody}` };\r\n" +
"    }\r\n" +
"    const result = await submitResp.json();\r\n" +
"    const txId = result.transactionId || '';\r\n" +
"    const explorerBase = network === 'mainnet' ? 'https://explorer.kaspa.org/txs/' : 'https://explorer-tn10.kaspa.org/txs/';\r\n" +
"    console.log('[REST-TX] Prepared tx broadcast:', txId);\r\n" +
"    return { success: true, txId, explorerUrl: explorerBase + txId };\r\n" +
"  } catch (e: any) {\r\n" +
"    return { success: false, error: e.message || 'Broadcast failed' };\r\n" +
"  }\r\n" +
"}\r\n" +
"\r\n" + K4,
"export async function broadcastPreparedTx");

// ================= C1: refund verify + cosign =================
const C1 = "// ============================================================================\n// SECTION 9: AGR ID (deterministic from pubkeys + amounts + UTXO tag)\n// ============================================================================";
guard(CS,'C1 section9',C1,1);
sub(CS,'C1',C1,
"// ============================================================================\r\n" +
"// SECTION 8b: REFUND CO-SIGN (counterparty side)\r\n" +
"// The refund pays ONLY the funder. verifyTemplate() would reject it outright\r\n" +
"// ('your output not found'), which is correct for a release but wrong here.\r\n" +
"// The co-signer's safety argument is different: I receive nothing, but this tx\r\n" +
"//   (a) spends ONLY the predicted escrow UTXO (which does not exist yet),\r\n" +
"//   (b) pays ONLY the funder's own P2PK script,\r\n" +
"//   (c) cannot confirm before lockTime = now + N.\r\n" +
"// ============================================================================\r\n" +
"export function verifyRefundTemplate(\r\n" +
"  template: TxTemplate,\r\n" +
"  funderXOnly: string,\r\n" +
"  expected: {\r\n" +
"    predictedTxId: string;\r\n" +
"    escrowScript: string;   // p2pkScript(frost aggXOnly)\r\n" +
"    N: bigint;              // from the signed proposal\r\n" +
"    currentDAA: bigint;\r\n" +
"    slackDAA?: bigint;      // tolerance on lockTime (default 600 = 10 min)\r\n" +
"  },\r\n" +
"): { valid: boolean; error?: string } {\r\n" +
"  const slack = expected.slackDAA ?? 600n;\r\n" +
"\r\n" +
"  if (template.u.length !== 1) return { valid: false, error: 'Refund must spend exactly 1 input, saw ' + template.u.length };\r\n" +
"  const u = template.u[0];\r\n" +
"  if (u.t !== expected.predictedTxId) return { valid: false, error: 'Refund input is not the predicted escrow txid' };\r\n" +
"  if (u.i !== 0) return { valid: false, error: 'Refund input index must be 0, saw ' + u.i };\r\n" +
"  if (u.s !== expected.escrowScript) return { valid: false, error: 'Refund input script is not the FROST escrow script' };\r\n" +
"\r\n" +
"  if (template.o.length !== 1) return { valid: false, error: 'Refund must have exactly 1 output, saw ' + template.o.length };\r\n" +
"  const funderScript = p2pkScript(funderXOnly);\r\n" +
"  if (template.o[0].s !== funderScript) return { valid: false, error: 'Refund output does not pay the funder' };\r\n" +
"  if (!isPureP2PK(template.o[0].s)) return { valid: false, error: 'Refund output is not standard P2PK — possible covenant' };\r\n" +
"\r\n" +
"  const lt = BigInt(template.lt || '0');\r\n" +
"  if (lt === 0n) return { valid: false, error: 'Refund has no lockTime — would be spendable immediately' };\r\n" +
"  const expectedLt = expected.currentDAA + expected.N;\r\n" +
"  const drift = lt > expectedLt ? lt - expectedLt : expectedLt - lt;\r\n" +
"  if (drift > slack) return { valid: false, error: 'lockTime ' + lt + ' does not match the agreed timeout (expected ~' + expectedLt + ')' };\r\n" +
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
"/** Counterparty co-signs the funder's timelocked refund. k born and dies here. */\r\n" +
"export function cosignRefundTemplate(params: {\r\n" +
"  privateKeyHex: string;\r\n" +
"  myPubkey: string;        // co-signer (buyer) — receives nothing\r\n" +
"  funderPubkey: string;    // seller — receives the refund output\r\n" +
"  counter: number;\r\n" +
"  template: TxTemplate;\r\n" +
"  expected: { predictedTxId: string; escrowScript: string; N: bigint; currentDAA: bigint; slackDAA?: bigint };\r\n" +
"}): { response: SellerResponse; responseB64: string } | { error: string } {\r\n" +
"  const { privateKeyHex, myPubkey, funderPubkey, counter, template } = params;\r\n" +
"\r\n" +
"  const funderXOnly = funderPubkey.length === 66 ? funderPubkey.slice(2) : funderPubkey;\r\n" +
"  const v = verifyRefundTemplate(template, funderXOnly, params.expected);\r\n" +
"  if (!v.valid) return { error: v.error || 'Refund verification failed' };\r\n" +
"\r\n" +
"  // Party mapping mirrors buildSellerRefund: the funder occupies the buyerPubkey slot.\r\n" +
"  // deriveAggregateKey/generateNonce sort internally, so the aggregate key is the\r\n" +
"  // same either way — the slot only selects which script receives the output.\r\n" +
"  const agg = deriveAggregateKey(funderPubkey, myPubkey, counter);\r\n" +
"  const nonce = generateNonce(privateKeyHex, funderPubkey, myPubkey, counter);\r\n" +
"\r\n" +
"  const inputs: CanonicalInput[] = template.u.map((u) => ({ txId: u.t, index: u.i, value: BigInt(u.a), scriptPubKey: u.s }));\r\n" +
"  const outputs: CanonicalOutput[] = template.o.map((o) => ({ value: BigInt(o.v), script: o.s }));\r\n" +
"\r\n" +
"  const partials: string[] = [];\r\n" +
"  for (let i = 0; i < inputs.length; i++) {\r\n" +
"    const shHex = bytesToHex(computeSighash(inputs, outputs, i, BigInt(template.lt || '0')));\r\n" +
"    partials.push(partialSign(nonce, template.R, agg.aggXOnly, shHex).s_hex);\r\n" +
"  }\r\n" +
"\r\n" +
"  const response: SellerResponse = { R: nonce.R_hex, s: partials };\r\n" +
"  return { response, responseB64: encodeResponse(response) };\r\n" +
"}\r\n" +
"\r\n" + C1,
"export function cosignRefundTemplate");

for (const f of [KT, CS]) { fs.writeFileSync(f, files[f]); console.log('WROTE ' + f); }
