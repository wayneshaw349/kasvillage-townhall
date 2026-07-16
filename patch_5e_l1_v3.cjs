// patch_5e_l1_v2.cjs — 5e-Guard reads L1 instead of doing DAA arithmetic.
//
// If the escrow UTXO's txid != the seller's predictedTxId, the refund's only
// input is spent. The refund is dead. The DAA window is meaningless.
// _N = 0n makes the existing `_N > 0n` test false, skipping the window block
// and falling through to the Kill-Gate, which already handles this case.
//
// v2: site 1539 shares its text with site 3902 (buyer co-signing the seller's
// refund template — its _N checks lockTime >= now + N and MUST NOT change).
// Disambiguated with a two-line anchor on the frostUtxos _fundDAA line.
const fs = require('fs');
const F = 'NeighborAgreement.tsx';
let s = fs.readFileSync(F, 'utf8');
const NL = s.includes('\r\n') ? '\r\n' : '\n';
let applied = 0;

const rx = (lines) =>
  new RegExp(lines.map(l => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[ \\t]*\\r?\\n[ \\t]*'));

function once(pat, tag) {
  const g = new RegExp(pat.source, 'g');
  const n = (s.match(g) || []).length;
  if (n !== 1) { console.error(`SKIP [${tag}] count = ${n}, expected 1`); return false; }
  return true;
}

// ---------- crash-recovery path (~1404) ----------
const A1 = 'const _N = BigInt(entry.timeoutN || 0);';
{
  const n = s.split(A1).length - 1;
  if (n !== 1) { console.error(`SKIP [cr] anchor count = ${n}`); }
  else {
    const i = s.indexOf(A1);
    const ls = s.lastIndexOf('\n', i) + 1;
    const ind = s.slice(ls, i);
    if (/\S/.test(ind)) { console.error('SKIP [cr] not at line start'); }
    else {
      const block = [
        '// L1 truth: escrow UTXO != seller funding output => refund input spent => refund dead.',
        "const _crKj = await SecureStore.getItemAsync('kv_kill_' + entry.agrId);",
        'const _crK = _crKj ? JSON.parse(_crKj) : null;',
        "const _crEsc = eUtxos[0]?.outpoint?.transactionId || '';",
        'const _crDead = !!(_crK && _crK.predictedTxId && _crEsc && _crEsc !== _crK.predictedTxId);',
        "if (_crDead) console.log('[5e-Guard] Crash-recovery: refund input spent — refund dead, window moot', entry.agrId.slice(0,12));",
        'const _N = _crDead ? 0n : BigInt(entry.timeoutN || 0);',
      ].map(l => ind + l).join(NL);
      s = s.slice(0, ls) + block + s.slice(i + A1.length);
      applied++; console.log('APPLIED [crash-recovery]');
    }
  }
}

// ---------- FROST-Poll path (~1539) ----------
const P2 = rx([
  'const _N = BigInt(Math.floor((contract.timeoutMinutes || 5) * DAA_PER_MIN));',
  'const _fundDAA = BigInt(frostUtxos[0]?.utxoEntry?.blockDaaScore || 0);',
]);
if (once(P2, 'frost-poll')) {
  const m = s.match(P2);
  const i = s.indexOf(m[0]);
  const ls = s.lastIndexOf('\n', i) + 1;
  const ind = s.slice(ls, i);
  if (/\S/.test(ind)) { console.error('SKIP [frost-poll] not at line start'); }
  else {
    const block = [
      '// L1 truth: escrow UTXO != seller funding output => refund input spent => refund dead.',
      "const _fpKj = await SecureStore.getItemAsync('kv_kill_' + contract.agreementId);",
      'const _fpK = _fpKj ? JSON.parse(_fpKj) : null;',
      "const _fpEsc = frostUtxos[0]?.outpoint?.transactionId || '';",
      'const _fpDead = !!(_fpK && _fpK.predictedTxId && _fpEsc && _fpEsc !== _fpK.predictedTxId);',
      "if (_fpDead) console.log('[5e-Guard] FROST-Poll: refund input spent — refund dead, window moot');",
      'const _N = _fpDead ? 0n : BigInt(Math.floor((contract.timeoutMinutes || 5) * DAA_PER_MIN));',
      'const _fundDAA = BigInt(frostUtxos[0]?.utxoEntry?.blockDaaScore || 0);',
    ].map(l => ind + l).join(NL);
    s = s.slice(0, ls) + block + s.slice(i + m[0].length);
    applied++; console.log('APPLIED [frost-poll]');
  }
}

if (applied !== 2) { console.error(`ABORT — ${applied}/2 applied, file NOT written`); process.exit(1); }

// ---------- post-conditions ----------
const post = [
  ['_crDead ? 0n', 1],
  ['_fpDead ? 0n', 1],
  ['_crK.predictedTxId', 2],
  ['_fpK.predictedTxId', 2],
  // 3902 (buyer co-sign) must be untouched: still exactly one bare _N there.
  ['const _N = BigInt(Math.floor((contract.timeoutMinutes || 5) * DAA_PER_MIN));', 1],
];
for (const [p, want] of post) {
  const got = s.split(p).length - 1;
  if (got !== want) { console.error(`ABORT post-condition "${p}" = ${got}, want ${want}`); process.exit(1); }
}

fs.writeFileSync(F, s);
console.log('WROTE ' + F);
console.log('');
console.log('Untouched by design:');
console.log('  3902 — buyer co-signing the seller refund template. Its _N gates');
console.log('         lockTime >= now + N. Changing it would break the co-sign.');
console.log('  FROST-Poll still derives N from contract.timeoutMinutes, not the');
console.log('         threaded timeoutN. They agree here (18000) by coincidence.');
