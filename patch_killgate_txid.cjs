// patch_killgate_txid.cjs
//
// THE HOLE
// The buyer's paste-4 handler stores the seller's kill tx after checking only
// its SHAPE: 1 input, 1 output, index 0, output script == escrow, lockTime 0.
// It never verifies the signatures and never ties the tx back to the refund
// template the buyer co-signed. predictedTxId is then taken from that blob and
// trusted by Kill-Gate:
//
//     if (escrowTxId === _k.predictedTxId) { broadcast kill; return; }
//     // fall through => "Seller UTXO already consumed - safe to fund"
//
// A mismatch is read as "the kill already ran". But a mismatch is ALSO what a
// fabricated kill tx looks like. Seller hands over a structurally-valid kill
// spending an unrelated outpoint Z. Escrow holds A. A !== Z, so the gate says
// safe to fund. Buyer funds. Seller's real refund on A is still live. Reclaim
// after N. Brick scam, straight through the front door.
//
// THE FIX
// If escrow != predictedTxId there are only two worlds: the kill ran (escrow
// now holds the kill's OWN output, so computeTxId(kill) === escrowTxId), or the
// kill is fake. That is decidable - the txid algorithm is proven, twice on-chain.
//
//   escrow === predictedTxId      -> A live, refund can fire, broadcast kill
//   escrow === computeTxId(kill)  -> A spent, refund dead, fund
//   neither                       -> bogus kill, refuse
//
// Fails closed: if computeTxId throws, killTxIdOf returns '' and every branch
// refuses to fund rather than proceeding on a guess.
const fs = require('fs');
const F = 'NeighborAgreement.tsx';
let s = fs.readFileSync(F, 'utf8');
const NL = s.includes('\r\n') ? '\r\n' : '\n';
let applied = 0;

const rx = (lines) =>
  new RegExp(lines.map(l => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[ \\t]*\\r?\\n[ \\t]*'));
const countRx = (p) => (s.match(new RegExp(p.source, 'g')) || []).length;

// Replace a unique single-line anchor with a block, preserving indentation.
function sub(anchor, lines, tag) {
  const n = s.split(anchor).length - 1;
  if (n !== 1) { console.error(`SKIP [${tag}] anchor count = ${n}, expected 1`); return; }
  const i = s.indexOf(anchor);
  const ls = s.lastIndexOf('\n', i) + 1;
  const ind = s.slice(ls, i);
  if (/\S/.test(ind)) { console.error(`SKIP [${tag}] anchor not at line start`); return; }
  s = s.slice(0, ls) + lines.map(l => ind + l).join(NL) + s.slice(i + anchor.length);
  applied++; console.log(`APPLIED [${tag}]`);
}

// Replace a unique multi-line (CRLF-tolerant) anchor with a block.
function subRx(pat, lines, tag) {
  const n = countRx(pat);
  if (n !== 1) { console.error(`SKIP [${tag}] anchor count = ${n}, expected 1`); return; }
  const m = s.match(pat);
  const i = s.indexOf(m[0]);
  const ls = s.lastIndexOf('\n', i) + 1;
  const ind = s.slice(ls, i);
  if (/\S/.test(ind)) { console.error(`SKIP [${tag}] anchor not at line start`); return; }
  s = s.slice(0, ls) + lines.map(l => ind + l).join(NL) + s.slice(i + m[0].length);
  applied++; console.log(`APPLIED [${tag}]`);
}

// ---------------- 1. import computeTxId ----------------
sub(
  "import { sendKaspaViaRest, broadcastPreparedTx } from './kaspa_rest_tx';",
  ["import { sendKaspaViaRest, broadcastPreparedTx, computeTxId } from './kaspa_rest_tx';"],
  'import'
);

// ---------------- 2. module-scope helper ----------------
sub(
  'const DAA_PER_MIN = 600;',
  [
    'const DAA_PER_MIN = 600;',
    '// The kill tx spends the seller funding output A and pays it straight back to',
    '// escrow. So once it lands, the escrow sole UTXO is the kill own output - an id',
    '// we can compute rather than take on the seller word. That turns "is the refund',
    '// dead?" into an L1 question with three answers instead of two:',
    '//   escrow === predictedTxId     -> A is live, refund can fire, do NOT fund',
    '//   escrow === computeTxId(kill) -> A is spent, refund is dead, safe to fund',
    '//   neither                      -> this kill tx has nothing to do with this',
    '//                                   escrow. A seller-supplied predictedTxId is',
    '//                                   not evidence of anything.',
    '// Returns \'\' on any malformed input, which makes every caller refuse to fund.',
    'function killTxIdOf(txBody: any): string {',
    '  try {',
    '    const _t = txBody && txBody.transaction;',
    "    if (!_t || !Array.isArray(_t.inputs) || !Array.isArray(_t.outputs)) return '';",
    "    if (_t.inputs.length === 0 || _t.outputs.length === 0) return '';",
    '    return computeTxId({',
    '      version: Number(_t.version || 0),',
    '      inputs: _t.inputs.map((i: any) => ({',
    "        prevTxId: String((i && i.previousOutpoint && i.previousOutpoint.transactionId) || ''),",
    '        prevIndex: Number((i && i.previousOutpoint && i.previousOutpoint.index) || 0),',
    "        sequence: BigInt((i && i.sequence) || '0'),",
    '      })),',
    '      outputs: _t.outputs.map((o: any) => ({',
    "        amount: BigInt((o && o.amount) || '0'),",
    '        scriptVersion: Number((o && o.scriptPublicKey && o.scriptPublicKey.version) || 0),',
    "        scriptHex: String((o && o.scriptPublicKey && o.scriptPublicKey.scriptPublicKey) || ''),",
    '      })),',
    "      lockTime: BigInt(_t.lockTime || '0'),",
    "      subnetworkId: String(_t.subnetworkId || '0000000000000000000000000000000000000000'),",
    "      gas: BigInt(_t.gas || '0'),",
    "      payloadHex: String(_t.payload || ''),",
    '    });',
    "  } catch (e) { console.warn('[Kill-Gate] killTxIdOf failed:', e); return ''; }",
    '}',
  ],
  'helper'
);

// ---------------- 3. crash-recovery: 5e-Guard deadness test ----------------
sub(
  'const _crDead = !!(_crK && _crK.predictedTxId && _crEsc && _crEsc !== _crK.predictedTxId);',
  [
    '// Dead means the escrow UTXO IS the kill output, not merely "not A".',
    "const _crKillId = _crK && _crK.txBody ? killTxIdOf(_crK.txBody) : '';",
    'const _crDead = !!(_crEsc && _crKillId && _crEsc === _crKillId);',
  ],
  'cr-dead'
);

// ---------------- 4. FROST-Poll: 5e-Guard deadness test ----------------
sub(
  'const _fpDead = !!(_fpK && _fpK.predictedTxId && _fpEsc && _fpEsc !== _fpK.predictedTxId);',
  [
    '// Dead means the escrow UTXO IS the kill output, not merely "not A".',
    "const _fpKillId = _fpK && _fpK.txBody ? killTxIdOf(_fpK.txBody) : '';",
    'const _fpDead = !!(_fpEsc && _fpKillId && _fpEsc === _fpKillId);',
  ],
  'fp-dead'
);

// ---------------- 5. crash-recovery Kill-Gate: third branch ----------------
subRx(
  rx([
    "const _eTxId = eUtxos[0]?.outpoint?.transactionId || '';",
    'if (_eTxId === _k.predictedTxId) {',
  ]),
  [
    "const _eTxId = eUtxos[0]?.outpoint?.transactionId || '';",
    'const _kKillId = killTxIdOf(_k.txBody);',
    'if (_eTxId !== _k.predictedTxId && _eTxId !== _kKillId) {',
    "  console.warn('[Kill-Gate] Crash-recovery: escrow is neither the kill input nor the kill output. This kill tx is not for this escrow. NOT funding.', entry.agrId.slice(0, 12));",
    '  continue;',
    '}',
    'if (_eTxId === _k.predictedTxId) {',
  ],
  'cr-killgate'
);

// ---------------- 6. FROST-Poll Kill-Gate: third branch ----------------
subRx(
  rx([
    "const _escrowTxId = frostUtxos[0]?.outpoint?.transactionId || '';",
    'if (_escrowTxId === _k.predictedTxId) {',
  ]),
  [
    "const _escrowTxId = frostUtxos[0]?.outpoint?.transactionId || '';",
    'const _kKillId = killTxIdOf(_k.txBody);',
    'if (_escrowTxId !== _k.predictedTxId && _escrowTxId !== _kKillId) {',
    "  console.warn('[Kill-Gate] Escrow is neither the kill input nor the kill output. This kill tx is not for this escrow. NOT funding.');",
    "  if (!cancelled) Alert.alert('Kill Tx Mismatch', 'The kill transaction the seller sent does not correspond to the collateral sitting in escrow, so it cannot cancel their refund. Your payment has NOT been sent. Ask the seller to re-send it, and do not fund until this clears.');",
    '  return;',
    '}',
    'if (_escrowTxId === _k.predictedTxId) {',
  ],
  'fp-killgate'
);

if (applied !== 6) { console.error(`ABORT - ${applied}/6 applied, file NOT written`); process.exit(1); }

// ---------------- post-conditions ----------------
const post = [
  ["import { sendKaspaViaRest, broadcastPreparedTx, computeTxId } from './kaspa_rest_tx';", 1],
  ['function killTxIdOf(txBody: any): string {', 1],
  ['_crEsc === _crKillId', 1],
  ['_fpEsc === _fpKillId', 1],
  ['const _kKillId = killTxIdOf(_k.txBody);', 2],
  // the old "not A therefore dead" inversion must be gone
  ['_crEsc !== _crK.predictedTxId', 0],
  ['_fpEsc !== _fpK.predictedTxId', 0],
  // the co-sign site must be untouched
  ['const _res = cosignRefundTemplate({', 1],
];
for (const [p, want] of post) {
  const got = s.split(p).length - 1;
  if (got !== want) { console.error(`ABORT post-condition "${p}" = ${got}, want ${want}`); process.exit(1); }
}

fs.writeFileSync(F, s);
console.log('WROTE ' + F);
console.log('');
console.log('Kill-Gate now has three answers, not two. A fabricated kill tx that');
console.log('spends an unrelated outpoint no longer reads as "already consumed".');
console.log('');
console.log('UNCHANGED, deliberately: the co-sign site already cross-checks');
console.log('refund.input === kill.input before the buyer signs. That check is');
console.log('correct and is what makes this one sufficient.');
console.log('');
console.log('STILL OPEN:');
console.log('  - Kill tx is clipboard-only. 4085 deletes the pending blob before');
console.log('    4091 copies the kill to the clipboard. Miss the alert, it is gone,');
console.log('    and the buyer can never fund.');
console.log('  - lockTime = currentDAA + N is stamped at freeze, so the seller');
console.log('    window burns while the buyer sits on the co-signature.');
console.log('  - Kill-and-walk still costs a buyer 168k sompi to hostage the');
console.log('    collateral permanently.');
