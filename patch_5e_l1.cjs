// patch_5e_l1.cjs — 5e-Guard: L1 truth before DAA arithmetic.
// If the escrow UTXO is no longer the seller's funding output, the refund's
// only input is spent. The refund is dead. The DAA window is meaningless.
// Setting _N = 0n makes the existing `_N > 0n` test false, skipping the whole
// window block and falling through to the Kill-Gate, which already handles this.
const fs = require('fs');
const F = 'NeighborAgreement.tsx';
let s = fs.readFileSync(F, 'utf8');
const NL = s.includes('\r\n') ? '\r\n' : '\n';
let applied = 0;

function inject(anchor, lines, tag) {
  const n = s.split(anchor).length - 1;
  if (n !== 1) { console.error(`SKIP [${tag}] anchor count = ${n}, expected 1`); return; }
  const i = s.indexOf(anchor);
  const ls = s.lastIndexOf('\n', i) + 1;
  const indent = s.slice(ls, i);
  if (/\S/.test(indent)) { console.error(`SKIP [${tag}] anchor not at line start`); return; }
  const block = lines.map(l => indent + l).join(NL) + NL + indent;
  s = s.slice(0, ls) + block + s.slice(i);
  applied++;
  console.log(`APPLIED [${tag}]`);
}

// ---- crash-recovery path (~line 1404) ----
inject(
  'const _N = BigInt(entry.timeoutN || 0);',
  [
    '// L1 truth: escrow UTXO != seller funding output => refund input spent => refund dead.',
    "const _crKj = await SecureStore.getItemAsync('kv_kill_' + entry.agrId);",
    'const _crK = _crKj ? JSON.parse(_crKj) : null;',
    "const _crEsc = eUtxos[0]?.outpoint?.transactionId || '';",
    'const _crDead = !!(_crK && _crK.predictedTxId && _crEsc && _crEsc !== _crK.predictedTxId);',
    "if (_crDead) console.log('[5e-Guard] Crash-recovery: refund input spent — refund dead, window moot', entry.agrId.slice(0,12));",
  ],
  'crash-recovery'
);
{
  const a = 'const _N = BigInt(entry.timeoutN || 0);';
  const n = s.split(a).length - 1;
  if (n === 1) { s = s.replace(a, 'const _N = _crDead ? 0n : BigInt(entry.timeoutN || 0);'); console.log('APPLIED [crash-recovery _N]'); applied++; }
  else console.error(`SKIP [crash-recovery _N] count = ${n}`);
}

// ---- foreground FROST-Poll path (~line 1539) ----
inject(
  'const _N = BigInt(Math.floor((contract.timeoutMinutes || 5) * DAA_PER_MIN));',
  [
    '// L1 truth: escrow UTXO != seller funding output => refund input spent => refund dead.',
    "const _fpKj = await SecureStore.getItemAsync('kv_kill_' + contract.agreementId);",
    'const _fpK = _fpKj ? JSON.parse(_fpKj) : null;',
    "const _fpEsc = frostUtxos[0]?.outpoint?.transactionId || '';",
    'const _fpDead = !!(_fpK && _fpK.predictedTxId && _fpEsc && _fpEsc !== _fpK.predictedTxId);',
    "if (_fpDead) console.log('[5e-Guard] FROST-Poll: refund input spent — refund dead, window moot');",
  ],
  'frost-poll'
);
{
  const a = 'const _N = BigInt(Math.floor((contract.timeoutMinutes || 5) * DAA_PER_MIN));';
  const n = s.split(a).length - 1;
  if (n === 1) { s = s.replace(a, 'const _N = _fpDead ? 0n : BigInt(Math.floor((contract.timeoutMinutes || 5) * DAA_PER_MIN));'); console.log('APPLIED [frost-poll _N]'); applied++; }
  else console.error(`SKIP [frost-poll _N] count = ${n}`);
}

if (applied !== 4) { console.error(`ABORT — ${applied}/4 applied, file NOT written`); process.exit(1); }

// post-conditions
const post = [
  ['_crDead ? 0n', 1],
  ['_fpDead ? 0n', 1],
  ['_crK.predictedTxId', 1],
  ['_fpK.predictedTxId', 1],
];
for (const [p, want] of post) {
  const got = s.split(p).length - 1;
  if (got !== want) { console.error(`ABORT post-condition "${p}" = ${got}, want ${want}`); process.exit(1); }
}

fs.writeFileSync(F, s);
console.log('WROTE ' + F);
console.log('');
console.log('NOTE: the FROST-Poll path still derives N from contract.timeoutMinutes,');
console.log('not the threaded timeoutN. They agree here (30 * DAA_PER_MIN = 18000),');
console.log('but that is coincidence, not a guarantee. Separate fix.');
