// patch_k_per_input_steps.cjs   —  PATCH 1 of 2  (crypto core)
//
// THE BUG
// generateNonce() is called ONCE per template, and that single k signs EVERY input:
//
//     const nonce = generateNonce(...);              // one k
//     for (let i = 0; i < inputs.length; i++)
//       partialSign(nonce, template.R, ...)          // used N times
//
// R_agg = k*G + R_counterparty is then identical for every input, so the BIP340
// parity flip is identical, so k is identical. Only e changes:
//
//     s0 = k + e0*d
//     s1 = k + e1*d
//     => d = (s0 - s1) / (e0 - e1)   mod N
//
// d is d_tweaked; the binding coefficient is public, so dividing it out yields the
// WALLET PRIVATE KEY. Every term is public: R_agg_x, aggXOnly, the sighashes
// (recomputable from the template), and the s values, which travel in plaintext
// over the clipboard. Symmetric: buyer solves for seller's key from s[], seller
// solves for buyer's from s_buyer = s_agg - s_seller.
//
// Refund and kill have 1 input -> one equation, two unknowns -> safe BY LUCK.
// RELEASE AND CANCEL HAVE 2. That is the leak.
//
// This is the same attack already documented in buildKillTx's own comment
// ("a shared k across the two would give d = (s1-s2)/(e1-e2) - the wallet key by
// division") - written about two transactions, while sitting across two inputs of
// one transaction six functions away.
//
// THE FIX
// One k per input, both sides. R becomes string[] in both wire types, aligned with
// u[]. Length gates everywhere so a v1 template (one R, N inputs) is IMPOSSIBLE to
// sign rather than merely discouraged.
//
// BREAKING: v1 templates/responses no longer parse. That is correct - a v1
// template must be refused, not signed.
const fs = require('fs');
const F = 'canonical_agreement_steps.ts';
let s = fs.readFileSync(F, 'utf8');
const NL = s.includes('\r\n') ? '\r\n' : '\n';
// Mixed-EOL tolerant: the tree has both, so a fixed '\r\n}\r\n' would skip past
// the real close and swallow the NEXT function whole.
const CLOSE_RX = /\r?\n\}\r?\n/g;
let applied = 0;

// --- exact single-line/blob replace, count-guarded ---
function sub(oldStr, newLines, tag) {
  const n = s.split(oldStr).length - 1;
  if (n !== 1) { console.error(`SKIP [${tag}] anchor count = ${n}, expected 1`); return; }
  const i = s.indexOf(oldStr);
  const ls = s.lastIndexOf('\n', i) + 1;
  const ind = s.slice(ls, i);
  if (/\S/.test(ind)) { console.error(`SKIP [${tag}] anchor not at line start`); return; }
  s = s.slice(0, ls) + newLines.map(l => (l ? ind + l : '')).join(NL) + s.slice(i + oldStr.length);
  applied++; console.log(`APPLIED [${tag}]`);
}

// --- replace a whole top-level function: from its signature to the next `\n}\n` ---
function replaceFn(startAnchor, newLines, tag) {
  const n = s.split(startAnchor).length - 1;
  if (n !== 1) { console.error(`SKIP [${tag}] signature count = ${n}, expected 1`); return; }
  const i = s.indexOf(startAnchor);
  CLOSE_RX.lastIndex = i;
  const m = CLOSE_RX.exec(s);
  if (!m) { console.error(`SKIP [${tag}] no closing brace at column 0`); return; }
  s = s.slice(0, i) + newLines.join(NL) + s.slice(m.index + m[0].length);
  applied++; console.log(`APPLIED [${tag}]`);
}

// ============================ 1. SCHEMA ============================
sub('export const AGREEMENT_SCHEMA_VERSION = 1;',
  ['// v2: R is per-input. v1 templates (one R, N inputs) leak the wallet key and',
   '// are rejected by parseTemplate/parseResponse.',
   'export const AGREEMENT_SCHEMA_VERSION = 2;'],
  'schema-version');

// ============================ 2. WIRE TYPES ============================
sub('  R: string;              // Buyer R nonce (compressed point hex)',
  ['R: string[];            // Buyer R nonces - ONE PER INPUT, aligned with u[]'],
  'type-TxTemplate-R');

sub('  R: string;       // Seller R nonce (compressed point hex)',
  ['R: string[];     // Seller R nonces - ONE PER INPUT, aligned with the template u[]'],
  'type-SellerResponse-R');

// ============================ 3. buildTemplate (unused, kept consistent) ==========
sub('  buyerR_hex: string;', ['buyerR_hex: string[];   // one per input, sorted order'], 'buildTemplate-param');
sub('    R: buyerR_hex,', ['R: buyerR_hex,'], 'buildTemplate-R');

// ============================ 4. buildReleaseTemplate ============================
replaceFn('export function buildReleaseTemplate(params: {', [
  'export function buildReleaseTemplate(params: {',
  '  utxos: { txId: string; index: number; amount: string; scriptPubKey: string }[];',
  '  partyA_xOnly: string;',
  '  partyB_xOnly: string;',
  '  partyA_depositSompi: bigint;',
  '  partyB_depositSompi: bigint;',
  '  mode: ReleaseMode;',
  '  fee?: bigint;',
  '  privateKeyHex: string;',
  '  buyerPubkey: string;',
  '  sellerPubkey: string;',
  '  counter: number;',
  '  agrId: string;',
  '}): { template: TxTemplate; description: string; nonces: FrostNonce[] } {',
  '  const sorted = [...params.utxos].sort((a, b) => a.txId.localeCompare(b.txId));',
  '  const totalIn = sorted.reduce((s, u) => s + BigInt(u.amount), 0n);',
  "  const numOutputs = params.mode === 'release' ? 1 : 2;",
  '  const fee = params.fee || BigInt(sorted.length * 115000 + numOutputs * 48000 + 5000);',
  '',
  '  // ONE k PER INPUT. Generated AFTER the sort so R[i] lines up with u[i].',
  '  const nonces: FrostNonce[] = sorted.map(() =>',
  '    generateNonce(params.privateKeyHex, params.buyerPubkey, params.sellerPubkey, params.counter)',
  '  );',
  '',
  '  const { outputs, description } = computeReleaseOutputs(',
  '    params.mode, totalIn, fee,',
  '    params.partyA_depositSompi, params.partyB_depositSompi,',
  '    params.partyA_xOnly, params.partyB_xOnly,',
  '  );',
  '',
  '  return {',
  '    template: {',
  '      u: sorted.map((u) => ({ t: u.txId, i: u.index, a: u.amount, s: u.scriptPubKey })),',
  '      o: outputs,',
  '      f: fee.toString(),',
  '      R: nonces.map((n) => n.R_hex),',
  '      agr: params.agrId,',
  '    },',
  '    description,',
  '    nonces,',
  '  };',
  '}',
  '',
], 'buildReleaseTemplate');

// ============================ 5. parseTemplate ============================
replaceFn('export function parseTemplate(b64: string): TxTemplate | null {', [
  'export function parseTemplate(b64: string): TxTemplate | null {',
  '  try {',
  '    const json = atob(b64);',
  '    const obj = JSON.parse(json);',
  '    if (!obj.u || !obj.o || !obj.R || !Array.isArray(obj.u) || !Array.isArray(obj.o)) {',
  '      return null;',
  '    }',
  '    // v1 templates carried ONE R for N inputs. Signing one leaks the wallet key',
  '    // by division. Refuse to parse rather than refuse to sign.',
  '    if (!Array.isArray(obj.R)) {',
  "      console.warn('[Template] REJECTED: v1 format (single R for all inputs). Ask for a fresh template.');",
  '      return null;',
  '    }',
  '    if (obj.R.length !== obj.u.length) {',
  "      console.warn('[Template] REJECTED:', obj.R.length, 'R nonces for', obj.u.length, 'inputs.');",
  '      return null;',
  '    }',
  '    return obj as TxTemplate;',
  '  } catch {',
  '    return null;',
  '  }',
  '}',
  '',
], 'parseTemplate');

// ============================ 6. parseResponse ============================
replaceFn('export function parseResponse(b64: string): SellerResponse | null {', [
  'export function parseResponse(b64: string): SellerResponse | null {',
  '  try {',
  '    const obj = JSON.parse(atob(b64));',
  '    if (!obj.R || !obj.s || !Array.isArray(obj.s)) return null;',
  '    // Same gate as parseTemplate: a scalar R means one k signed every input.',
  '    if (!Array.isArray(obj.R)) {',
  "      console.warn('[Response] REJECTED: v1 format (single R for all inputs).');",
  '      return null;',
  '    }',
  '    if (obj.R.length !== obj.s.length) {',
  "      console.warn('[Response] REJECTED:', obj.R.length, 'R nonces for', obj.s.length, 'partials.');",
  '      return null;',
  '    }',
  '    return obj as SellerResponse;',
  '  } catch {',
  '    return null;',
  '  }',
  '}',
  '',
], 'parseResponse');

// ============================ 7. buildSellerRefund ============================
replaceFn('export function buildSellerRefund(params: {', [
  'export function buildSellerRefund(params: {',
  '  sellerPrivKeyHex: string;',
  '  sellerPubkey: string;   // reclaiming party (partyA) - receives the refund output',
  '  buyerPubkey: string;    // counterparty (partyB)',
  '  counter: number;',
  '  predictedEscrowUtxo: { txId: string; index: number; amount: string; scriptPubKey: string };',
  '  fundDAA: bigint;',
  '  N: bigint;              // timeout window in DAA (from proposal)',
  '  agrId: string;',
  '}): { template: TxTemplate; templateB64: string; nonces: FrostNonce[]; sighashes: string[] } {',
  '  return buyerBuildTemplate({',
  '    privateKeyHex: params.sellerPrivKeyHex,',
  '    buyerPubkey: params.sellerPubkey,   // partyA = seller = gets the refund output',
  '    sellerPubkey: params.buyerPubkey,   // partyB = buyer = counterparty',
  '    counter: params.counter,',
  '    utxos: [params.predictedEscrowUtxo],',
  '    buyerAmountSompi: BigInt(params.predictedEscrowUtxo.amount),',
  "    releaseMode: 'refund',",
  '    lockTime: params.fundDAA + params.N,',
  '    agrId: params.agrId,',
  '  });',
  '}',
  '',
], 'buildSellerRefund');

// ============================ 8. buyerBuildTemplate ============================
replaceFn('export function buyerBuildTemplate(params: {', [
  'export function buyerBuildTemplate(params: {',
  '  privateKeyHex: string;',
  '  buyerPubkey: string;',
  '  sellerPubkey: string;',
  '  counter: number;',
  '  utxos: { txId: string; index: number; amount: string; scriptPubKey: string }[];',
  '  buyerAmountSompi: bigint;',
  '  sellerAmountSompi?: bigint;',
  '  releaseMode?: ReleaseMode;',
  '  fee?: bigint;',
  '  agrId: string;',
  '  lockTime?: bigint;',
  '}): {',
  '  template: TxTemplate;',
  '  templateB64: string;',
  '  nonces: FrostNonce[];',
  '  sighashes: string[];',
  '} {',
  "  const numOutputs = ((params.releaseMode || 'release') === 'cancel') ? 2 : 1;",
  '  const fee = params.fee || BigInt(params.utxos.length * 115000 + numOutputs * 48000 + 5000);',
  '',
  '  const buyerXOnly =',
  '    params.buyerPubkey.length === 66 ? params.buyerPubkey.slice(2) : params.buyerPubkey;',
  '  const sellerXOnly =',
  '    params.sellerPubkey.length === 66 ? params.sellerPubkey.slice(2) : params.sellerPubkey;',
  '',
  "  const mode: ReleaseMode = params.releaseMode || 'release';",
  '  const sorted = [...params.utxos].sort((a, b) => a.txId.localeCompare(b.txId));',
  '  const totalIn = sorted.reduce((s, u) => s + BigInt(u.amount), 0n);',
  '  const sellerDeposit = params.sellerAmountSompi ?? (totalIn - params.buyerAmountSompi - fee);',
  '',
  '  // ONE k PER INPUT (k born here, one per input). Sharing a k across inputs gives',
  '  // d = (s0-s1)/(e0-e1) - the wallet key by division. Generated after the sort so',
  '  // R[i] lines up with u[i].',
  '  const nonces: FrostNonce[] = sorted.map(() =>',
  '    generateNonce(params.privateKeyHex, params.buyerPubkey, params.sellerPubkey, params.counter)',
  '  );',
  '',
  '  const { outputs } = computeReleaseOutputs(',
  '    mode, totalIn, fee,',
  '    params.buyerAmountSompi, sellerDeposit,',
  '    buyerXOnly, sellerXOnly,',
  '  );',
  '',
  '  const template: TxTemplate = {',
  '    u: sorted.map((u) => ({ t: u.txId, i: u.index, a: u.amount, s: u.scriptPubKey })),',
  '    o: outputs,',
  '    f: fee.toString(),',
  '    R: nonces.map((n) => n.R_hex),',
  '    agr: params.agrId,',
  "    lt: (params.lockTime ?? 0n).toString(),",
  '  };',
  '',
  '  const inputs: CanonicalInput[] = template.u.map((u) => ({',
  '    txId: u.t,',
  '    index: u.i,',
  '    value: BigInt(u.a),',
  '    scriptPubKey: u.s,',
  '  }));',
  '  const canonOutputs: CanonicalOutput[] = template.o.map((o) => ({',
  '    value: BigInt(o.v),',
  '    script: o.s,',
  '  }));',
  '',
  '  const sighashes: string[] = [];',
  '  for (let i = 0; i < inputs.length; i++) {',
  "    sighashes.push(bytesToHex(computeSighash(inputs, canonOutputs, i, BigInt(template.lt || '0'))));",
  '  }',
  '',
  '  return {',
  '    template,',
  '    templateB64: encodeTemplate(template),',
  '    nonces,',
  '    sighashes,',
  '  };',
  '}',
  '',
], 'buyerBuildTemplate');

// ============================ 9. sellerSignTemplate ============================
replaceFn('export function sellerSignTemplate(params: {', [
  'export function sellerSignTemplate(params: {',
  '  privateKeyHex: string;',
  '  sellerPubkey: string;',
  '  buyerPubkey: string;',
  '  counter: number;',
  '  template: TxTemplate;',
  '}): {',
  '  response: SellerResponse;',
  '  responseB64: string;',
  '  verification: ReturnType<typeof verifyTemplate>;',
  '} | { error: string } {',
  '  const { privateKeyHex, sellerPubkey, buyerPubkey, counter, template } = params;',
  '',
  '  // A template with fewer R nonces than inputs is a v1 template. Signing it would',
  '  // publish two s values under one k and hand over the wallet key. Refuse.',
  '  if (!Array.isArray(template.R) || template.R.length !== template.u.length) {',
  "    return { error: 'Template carries ' + (Array.isArray(template.R) ? template.R.length : 1) + ' R nonce(s) for ' + template.u.length + ' input(s). One k per input is required - refusing to sign. Ask for a fresh template.' };",
  '  }',
  '',
  '  const sellerXOnly =',
  '    sellerPubkey.length === 66 ? sellerPubkey.slice(2) : sellerPubkey;',
  '  const verification = verifyTemplate(template, sellerXOnly);',
  '  if (!verification.valid) {',
  "    return { error: verification.error || 'Template verification failed' };",
  '  }',
  '',
  '  const agg = deriveAggregateKey(buyerPubkey, sellerPubkey, counter);',
  '',
  '  const inputs: CanonicalInput[] = template.u.map((u) => ({',
  '    txId: u.t,',
  '    index: u.i,',
  '    value: BigInt(u.a),',
  '    scriptPubKey: u.s,',
  '  }));',
  '  const outputs: CanonicalOutput[] = template.o.map((o) => ({',
  '    value: BigInt(o.v),',
  '    script: o.s,',
  '  }));',
  '',
  '  const partials: string[] = [];',
  '  const myR: string[] = [];',
  '  for (let i = 0; i < inputs.length; i++) {',
  '    // Fresh k for THIS input only. Born and dies inside this loop iteration.',
  '    const nonce = generateNonce(privateKeyHex, buyerPubkey, sellerPubkey, counter);',
  '    myR.push(nonce.R_hex);',
  "    const shHex = bytesToHex(computeSighash(inputs, outputs, i, BigInt(template.lt || '0')));",
  '    const ps = partialSign(nonce, template.R[i], agg.aggXOnly, shHex);',
  '    partials.push(ps.s_hex);',
  '  }',
  '',
  '  const response: SellerResponse = { R: myR, s: partials };',
  '',
  '  return {',
  '    response,',
  '    responseB64: encodeResponse(response),',
  '    verification,',
  '  };',
  '}',
  '',
], 'sellerSignTemplate');

// ============================ 10. buyerAggregate ============================
replaceFn('export function buyerAggregate(params: {', [
  'export function buyerAggregate(params: {',
  '  nonces: FrostNonce[];',
  '  buyerPubkey: string;',
  '  sellerPubkey: string;',
  '  counter: number;',
  '  template: TxTemplate;',
  '  sellerResponse: SellerResponse;',
  '}): { txBody: object; signatures: string[] } | { error: string } {',
  '  const { nonces, buyerPubkey, sellerPubkey, counter, template, sellerResponse } = params;',
  '',
  '  // Every array must line up with u[], or somebody reused a k.',
  '  if (!Array.isArray(nonces) || nonces.length !== template.u.length) {',
  "    return { error: 'Have ' + (Array.isArray(nonces) ? nonces.length : 0) + ' nonce(s) for ' + template.u.length + ' input(s) - one k per input is required.' };",
  '  }',
  '  if (!Array.isArray(template.R) || template.R.length !== template.u.length) {',
  "    return { error: 'Template carries the wrong number of R nonces - refusing.' };",
  '  }',
  '  if (!Array.isArray(sellerResponse.R) || sellerResponse.R.length !== template.u.length) {',
  "    return { error: 'Counterparty sent ' + (Array.isArray(sellerResponse.R) ? sellerResponse.R.length : 1) + ' R nonce(s) for ' + template.u.length + ' input(s). They reused a k - do NOT broadcast, and tell them to update.' };",
  '  }',
  '  if (sellerResponse.s.length !== template.u.length) {',
  "    return { error: 'Counterparty sent ' + sellerResponse.s.length + ' partial(s) for ' + template.u.length + ' input(s).' };",
  '  }',
  '',
  '  const agg = deriveAggregateKey(buyerPubkey, sellerPubkey, counter);',
  '',
  '  const inputs: CanonicalInput[] = template.u.map((u) => ({',
  '    txId: u.t,',
  '    index: u.i,',
  '    value: BigInt(u.a),',
  '    scriptPubKey: u.s,',
  '  }));',
  '  const outputs: CanonicalOutput[] = template.o.map((o) => ({',
  '    value: BigInt(o.v),',
  '    script: o.s,',
  '  }));',
  '',
  '  const signatures: string[] = [];',
  '',
  '  for (let i = 0; i < inputs.length; i++) {',
  "    const shHex = bytesToHex(computeSighash(inputs, outputs, i, BigInt(template.lt || '0')));",
  '',
  '    // nonces[i] signed input i and nothing else.',
  '    const buyerPartial = partialSign(nonces[i], sellerResponse.R[i], agg.aggXOnly, shHex);',
  '',
  '    const sigHex = aggregateSigs(',
  '      buyerPartial.R_agg_x_hex,',
  '      buyerPartial.s_hex,',
  '      sellerResponse.s[i]',
  '    );',
  '',
  '    if (!verifySig(sigHex, shHex, agg.aggXOnly)) {',
  "      return { error: `Input ${i} failed BIP340 verification. Aborting.` };",
  '    }',
  '',
  '    signatures.push(sigHex);',
  '  }',
  '',
  '  return {',
  '    txBody: buildTxBody(template, signatures),',
  '    signatures,',
  '  };',
  '}',
  '',
], 'buyerAggregate');

// ============================ 11. cosignRefundTemplate ============================
replaceFn('export function cosignRefundTemplate(params: {', [
  'export function cosignRefundTemplate(params: {',
  '  privateKeyHex: string;',
  '  myPubkey: string;        // co-signer (buyer) - receives nothing',
  '  funderPubkey: string;    // seller - receives the refund output',
  '  counter: number;',
  '  template: TxTemplate;',
  '  expected: { predictedTxId: string; escrowScript: string; N: bigint; currentDAA: bigint; slackDAA?: bigint; minRemainingDAA?: bigint };',
  '}): { response: SellerResponse; responseB64: string } | { error: string } {',
  '  const { privateKeyHex, myPubkey, funderPubkey, counter, template } = params;',
  '',
  '  if (!Array.isArray(template.R) || template.R.length !== template.u.length) {',
  "    return { error: 'Refund template carries ' + (Array.isArray(template.R) ? template.R.length : 1) + ' R nonce(s) for ' + template.u.length + ' input(s). One k per input is required - refusing to sign.' };",
  '  }',
  '',
  '  const funderXOnly = funderPubkey.length === 66 ? funderPubkey.slice(2) : funderPubkey;',
  '  const v = verifyRefundTemplate(template, funderXOnly, params.expected);',
  "  if (!v.valid) return { error: v.error || 'Refund verification failed' };",
  '',
  '  const agg = deriveAggregateKey(funderPubkey, myPubkey, counter);',
  '',
  '  const inputs: CanonicalInput[] = template.u.map((u) => ({ txId: u.t, index: u.i, value: BigInt(u.a), scriptPubKey: u.s }));',
  '  const outputs: CanonicalOutput[] = template.o.map((o) => ({ value: BigInt(o.v), script: o.s }));',
  '',
  '  const partials: string[] = [];',
  '  const myR: string[] = [];',
  '  for (let i = 0; i < inputs.length; i++) {',
  '    const nonce = generateNonce(privateKeyHex, funderPubkey, myPubkey, counter);  // fresh k per input',
  '    myR.push(nonce.R_hex);',
  "    const shHex = bytesToHex(computeSighash(inputs, outputs, i, BigInt(template.lt || '0')));",
  '    partials.push(partialSign(nonce, template.R[i], agg.aggXOnly, shHex).s_hex);',
  '  }',
  '',
  '  const response: SellerResponse = { R: myR, s: partials };',
  '  return { response, responseB64: encodeResponse(response) };',
  '}',
  '',
], 'cosignRefundTemplate');

// ============================ 12. buildKillTx ============================
replaceFn('export function buildKillTx(params: {', [
  'export function buildKillTx(params: {',
  '  sellerPrivKeyHex: string;',
  '  sellerPubkey: string;',
  '  buyerPubkey: string;',
  '  counter: number;',
  '  predictedEscrowUtxo: { txId: string; index: number; amount: string; scriptPubKey: string };',
  '  agrId: string;',
  '  fee?: bigint;',
  '}): { template: TxTemplate; templateB64: string; nonces: FrostNonce[]; sighashes: string[] } {',
  '  const u = params.predictedEscrowUtxo;',
  '  const fee = params.fee || BigInt(1 * 115000 + 1 * 48000 + 5000);',
  '  const totalIn = BigInt(u.amount);',
  "  if (totalIn <= fee) throw new Error('Kill: escrow amount too low for fee');",
  '',
  '  // Fresh random k per input. NEVER derive k from the tx, and never share one',
  '  // across inputs: the refund and the kill spend the SAME utxo with DIFFERENT',
  '  // outputs, so a shared k would give d = (s1-s2)/(e1-e2) - the wallet key by',
  '  // division. Same reason two inputs of one tx may not share a k.',
  '  const inputsRaw = [{ t: u.txId, i: u.index, a: u.amount, s: u.scriptPubKey }];',
  '  const nonces: FrostNonce[] = inputsRaw.map(() =>',
  '    generateNonce(params.sellerPrivKeyHex, params.sellerPubkey, params.buyerPubkey, params.counter)',
  '  );',
  '',
  '  const template: TxTemplate = {',
  '    u: inputsRaw,',
  '    o: [{ v: (totalIn - fee).toString(), s: u.scriptPubKey }],  // back to the escrow',
  '    f: fee.toString(),',
  '    R: nonces.map((n) => n.R_hex),',
  '    agr: params.agrId,',
  "    lt: '0',                                                    // spendable immediately",
  '  };',
  '',
  '  const inputs: CanonicalInput[] = template.u.map((x) => ({ txId: x.t, index: x.i, value: BigInt(x.a), scriptPubKey: x.s }));',
  '  const outputs: CanonicalOutput[] = template.o.map((o) => ({ value: BigInt(o.v), script: o.s }));',
  '  const sighashes: string[] = [];',
  '  for (let i = 0; i < inputs.length; i++) sighashes.push(bytesToHex(computeSighash(inputs, outputs, i, 0n)));',
  '',
  '  return { template, templateB64: encodeTemplate(template), nonces, sighashes };',
  '}',
  '',
], 'buildKillTx');

// ============================ 13. cosignKillTemplate ============================
replaceFn('export function cosignKillTemplate(params: {', [
  'export function cosignKillTemplate(params: {',
  '  privateKeyHex: string;',
  '  myPubkey: string;        // co-signer (buyer)',
  '  funderPubkey: string;    // seller - whose UTXO is being consumed',
  '  counter: number;',
  '  template: TxTemplate;',
  '  expected: { predictedTxId: string; escrowScript: string };',
  '}): { response: SellerResponse; responseB64: string } | { error: string } {',
  '  const { privateKeyHex, myPubkey, funderPubkey, counter, template } = params;',
  '',
  '  if (!Array.isArray(template.R) || template.R.length !== template.u.length) {',
  "    return { error: 'Kill template carries ' + (Array.isArray(template.R) ? template.R.length : 1) + ' R nonce(s) for ' + template.u.length + ' input(s). One k per input is required - refusing to sign.' };",
  '  }',
  '',
  '  const v = verifyKillTemplate(template, params.expected);',
  "  if (!v.valid) return { error: v.error || 'Kill verification failed' };",
  '',
  '  const agg = deriveAggregateKey(funderPubkey, myPubkey, counter);',
  '',
  '  const inputs: CanonicalInput[] = template.u.map((u) => ({ txId: u.t, index: u.i, value: BigInt(u.a), scriptPubKey: u.s }));',
  '  const outputs: CanonicalOutput[] = template.o.map((o) => ({ value: BigInt(o.v), script: o.s }));',
  '',
  '  const partials: string[] = [];',
  '  const myR: string[] = [];',
  '  for (let i = 0; i < inputs.length; i++) {',
  '    const nonce = generateNonce(privateKeyHex, funderPubkey, myPubkey, counter);  // fresh k per input',
  '    myR.push(nonce.R_hex);',
  '    const shHex = bytesToHex(computeSighash(inputs, outputs, i, 0n));',
  '    partials.push(partialSign(nonce, template.R[i], agg.aggXOnly, shHex).s_hex);',
  '  }',
  '',
  '  const response: SellerResponse = { R: myR, s: partials };',
  '  return { response, responseB64: encodeResponse(response) };',
  '}',
  '',
], 'cosignKillTemplate');

// ============================ 14. verify* R-length gates ============================
sub("  if (template.u.length !== 1) return { valid: false, error: 'Refund must spend exactly 1 input, saw ' + template.u.length };",
  ["if (!Array.isArray(template.R) || template.R.length !== template.u.length) return { valid: false, error: 'Refund template must carry one R nonce per input (v2)' };",
   "if (template.u.length !== 1) return { valid: false, error: 'Refund must spend exactly 1 input, saw ' + template.u.length };"],
  'verifyRefund-R-gate');

sub("  if (template.u.length !== 1) return { valid: false, error: 'Kill must spend exactly 1 input, saw ' + template.u.length };",
  ["if (!Array.isArray(template.R) || template.R.length !== template.u.length) return { valid: false, error: 'Kill template must carry one R nonce per input (v2)' };",
   "if (template.u.length !== 1) return { valid: false, error: 'Kill must spend exactly 1 input, saw ' + template.u.length };"],
  'verifyKill-R-gate');

// ============================ CHECKS ============================
// 17 operations. Previous version said 16, so one SKIP still passed the guard.
if (applied !== 17) { console.error(`ABORT - ${applied}/17 applied, file NOT written`); process.exit(1); }

const post = [
  ['export const AGREEMENT_SCHEMA_VERSION = 2;', 1],
  ['R: string[];', 2],
  // one generateNonce per signing site: build(2 via map) + seller + agg? no:
  // buildReleaseTemplate, buyerBuildTemplate, buildKillTx use .map; seller/cosign x2 use loop
  ['const nonces: FrostNonce[] = sorted.map(() =>', 2],
  ['const nonces: FrostNonce[] = inputsRaw.map(() =>', 1],
  ['const myR: string[] = [];', 3],
  ['nonces: FrostNonce[];', 4],
  // the reuse must be gone: no partialSign may take a scalar template.R / response.R
  ['partialSign(nonce, template.R,', 0],
  ['partialSign(nonce, sellerResponse.R,', 0],
  ['partialSign(nonce, template.R[i],', 3],
  ['partialSign(nonces[i], sellerResponse.R[i],', 1],
  ['partialSign(nonce, template.R[i], agg.aggXOnly, shHex);', 1],
];
for (const [p, want] of post) {
  const got = s.split(p).length - 1;
  if (got !== want) { console.error(`ABORT post-condition "${p}" = ${got}, want ${want}`); process.exit(1); }
}

fs.writeFileSync(F, s);
console.log('WROTE ' + F);
console.log('');
console.log('Now run tsc. NeighborAgreement.tsx WILL break - that is patch 2:');
console.log('  _refund.nonce / _kill.nonce      -> .nonces');
console.log('  buyerAggregate({ nonce: ... })   -> { nonces: [...] }');
console.log('  buildReleaseTemplateFn R_hex     -> privateKeyHex/pubkeys/counter');
console.log('  kv_frost_nonce_ + kv_refund_pending_.nonce/.killNonce -> arrays');
console.log('');
console.log('  npx tsc --noEmit 2>&1 | Select-String "canonical_agreement_steps.ts"');
console.log('  npx tsc --noEmit 2>&1 | Select-String "NeighborAgreement.tsx" | Measure-Object | Select Count');
console.log('');
console.log('canonical_agreement_steps.ts baseline was 7. Send me both numbers.');
