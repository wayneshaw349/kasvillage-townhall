const fs = require('fs');

// ---------- NeighborAgreement.tsx: seller locks own share, not total ----------
{
  const F = 'NeighborAgreement.tsx';
  let s = fs.readFileSync(F, 'utf8');
  if (s.includes('LOCK-OWN-SHARE')) throw new Error('NA already patched - abort');

  const A1 = "const myLockAmount = BigInt(Math.floor(sellerAmount * 1e8));";
  let n = s.split(A1).length - 1;
  if (n !== 1) throw new Error('lock anchor found ' + n + 'x - abort');
  const A2 = "console.log('[Neighbor] Spendable reduced by', sellerAmount, 'KASPA for', agrId);";
  n = s.split(A2).length - 1;
  if (n !== 1) throw new Error('log anchor found ' + n + 'x - abort');

  fs.writeFileSync(F + '.bak_lock', s);
  s = s.replace(A1, "const myLockAmount = BigInt(Math.floor(((canon?.role === 'buyer' ? buyerKas : sellerKas) || 0) * 1e8)); /* LOCK-OWN-SHARE: acceptor locks only their side, never the total */");
  s = s.replace(A2, "console.log('[Neighbor] Spendable reduced by', Number(myLockAmount) / 1e8, 'KASPA for', agrId);");
  fs.writeFileSync(F, s);
  const v = fs.readFileSync(F, 'utf8');
  if (!v.includes('LOCK-OWN-SHARE')) throw new Error('POST NA: marker missing');
  console.log('OK NeighborAgreement - acceptor locks own share (.bak_lock)');
}

// ---------- utxo_ledger.ts: smallest-single-cover selection ----------
{
  const F = 'utxo_ledger.ts';
  let s = fs.readFileSync(F, 'utf8');
  if (s.includes('SMALLEST-COVER')) throw new Error('ledger already patched - abort');

  const SORT = ".sort((a, b) => Number(BigInt(a.amountSompi) - BigInt(b.amountSompi)));";
  let n = s.split(SORT).length - 1;
  if (n !== 2) throw new Error('sort anchor found ' + n + 'x (expected 2: commitForCollateral + canonicalCommit) - abort');

  const LOOP = "for (const entry of freeEntries) {";
  n = s.split(LOOP).length - 1;
  if (n !== 2) throw new Error('loop anchor found ' + n + 'x (expected 2) - abort');

  fs.writeFileSync(F + '.bak_cover', s);

  const SORT_NEW = SORT + "\n" +
"  /* SMALLEST-COVER: prefer the single smallest coin that covers the amount - binds one coin instead of dragging large coins into small agreements */\n" +
"  const _coverEntry = freeEntries.find(e => BigInt(e.amountSompi) >= amountSompi);\n" +
"  const _pickList = _coverEntry ? [_coverEntry] : freeEntries;";
  s = s.split(SORT).join(SORT_NEW);
  s = s.split(LOOP).join("for (const entry of _pickList) {");

  fs.writeFileSync(F, s);
  const v = fs.readFileSync(F, 'utf8');
  if ((v.match(/SMALLEST-COVER/g) || []).length !== 2) throw new Error('POST ul: expected cover in both fns');
  if (v.includes(LOOP)) throw new Error('POST ul: old loop still present');
  console.log('OK utxo_ledger - smallest-cover selection in commitForCollateral + canonicalCommit (.bak_cover)');
}
