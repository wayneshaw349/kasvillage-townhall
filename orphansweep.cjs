const fs = require('fs');

// ---------- utxo_ledger.ts: orphan IOU allocation sweep ----------
{
  const F = 'utxo_ledger.ts';
  let s = fs.readFileSync(F, 'utf8');
  if (s.includes('releaseOrphanIOUs')) throw new Error('utxo_ledger already patched - abort');

  const AN = "export async function getSpendableUtxos(ad";
  const n = s.split(AN).length - 1;
  if (n !== 1) throw new Error('anchor found ' + n + 'x - abort');

  const NEW =
"/**\n" +
" * ORPHAN-IOU-SWEEP: release allocations whose iouId matches no live IOU/prop record.\n" +
" * Mirrors releaseOrphanCollateral. Pass the set of live ids (SignedIOU ids + 'prop_'+nonce\n" +
" * for pending/accepted prop-IOUs). Anything else is stale and frees.\n" +
" */\n" +
"export async function releaseOrphanIOUs(liveIouIds: string[]): Promise<number> {\n" +
"  const live = new Set(liveIouIds);\n" +
"  const ledger = await loadLedger();\n" +
"  let freedCount = 0;\n" +
"  for (const entry of ledger.values()) {\n" +
"    if (!entry.allocations || !entry.allocations.length) continue;\n" +
"    const stale = entry.allocations.filter(a => !live.has(a.iouId));\n" +
"    if (!stale.length) continue;\n" +
"    const freed = stale.reduce((acc, a) => acc + BigInt(a.sompi), 0n);\n" +
"    entry.allocations = entry.allocations.filter(a => live.has(a.iouId));\n" +
"    entry.allocatedSompi = String(BigInt(entry.allocatedSompi ?? '0') - freed);\n" +
"    if (BigInt(entry.allocatedSompi) <= 0n) {\n" +
"      entry.allocatedSompi = '0';\n" +
"      entry.allocations = entry.allocations.length ? entry.allocations : undefined;\n" +
"      if (entry.status === 'iou-allocated') entry.status = 'free';\n" +
"    } else if (entry.status === 'iou-allocated') {\n" +
"      entry.status = 'free';\n" +
"    }\n" +
"    freedCount += stale.length;\n" +
"    console.log('[UTXO-Ledger] Orphan IOU sweep freed', Number(freed) / 1e8, 'KAS from', entry.utxoKey.slice(0, 20), '(', stale.map(a => a.iouId).join(','), ')');\n" +
"  }\n" +
"  if (freedCount) await saveLedger(ledger);\n" +
"  return freedCount;\n" +
"}\n\n" +
AN;

  fs.writeFileSync(F + '.bak_orphan', s);
  s = s.replace(AN, NEW);
  fs.writeFileSync(F, s);
  const v = fs.readFileSync(F, 'utf8');
  if (!v.includes('releaseOrphanIOUs')) throw new Error('POST ul: sweep missing');
  console.log('OK utxo_ledger - releaseOrphanIOUs added (.bak_orphan)');
}

// ---------- IOUBalanceSheetShare.tsx: call sweep on sheet load ----------
{
  const F = 'IOUBalanceSheetShare.tsx';
  let s = fs.readFileSync(F, 'utf8');
  if (s.includes('ORPHAN-IOU-SWEEP-CALL')) throw new Error('sheet already patched - abort');

  // import: extend the utxo_ledger import
  const IMP = "from './utxo_ledger';";
  const impN = s.split(IMP).length - 1;
  if (impN !== 1) throw new Error('utxo_ledger import found ' + impN + 'x - abort');
  const impLineMatch = s.match(/import \{[^}]*\} from '\.\/utxo_ledger';/);
  if (!impLineMatch) throw new Error('utxo_ledger import shape unexpected - abort');
  const impLine = impLineMatch[0];
  if (!impLine.includes('releaseOrphanIOUs')) {
    s = s.replace(impLine, impLine.replace("} from './utxo_ledger';", ", releaseOrphanIOUs } from './utxo_ledger';"));
  }

  // hook into the prop-IOU load effect
  const EFF = "React.useEffect(() => { (async () => { try { const j = await AsyncStorage.getItem('kv_prop_ious'); if (j) setPropIOUs(JSON.parse(j)); } catch {} })(); }, []);";
  const effN = s.split(EFF).length - 1;
  if (effN !== 1) throw new Error('prop-IOU effect anchor found ' + effN + 'x - abort');

  const NEWEFF =
"React.useEffect(() => { (async () => { try { const j = await AsyncStorage.getItem('kv_prop_ious'); const arr = j ? JSON.parse(j) : []; setPropIOUs(arr); " +
"/* ORPHAN-IOU-SWEEP-CALL: free stale iou-*/ " +
"const liveProp = arr.filter((p: any) => p.status === 'awaiting_acceptance' || p.status === 'accepted').map((p: any) => 'prop_' + p.nonce); " +
"const pend = await loadPendingIOUs(); const liveSigned = pend.filter((i: any) => i.status === 'pending' || i.status === 'signed').map((i: any) => i.id); " +
"const ledgers = await loadLedgers(); const liveLedger: string[] = []; for (const l of ledgers) for (const i of (l.ious || [])) if (i.status === 'pending' || i.status === 'signed') liveLedger.push(i.id); " +
"const freed = await releaseOrphanIOUs([...liveProp, ...liveSigned, ...liveLedger]); if (freed) console.log('[IOU] Orphan sweep freed', freed, 'stale allocation(s)'); " +
"} catch (e) { console.warn('[IOU] orphan sweep failed:', e); } })(); }, []);";

  fs.writeFileSync(F + '.bak_orphan', s);
  s = s.replace(EFF, NEWEFF);
  fs.writeFileSync(F, s);
  const v = fs.readFileSync(F, 'utf8');
  if (!v.includes('ORPHAN-IOU-SWEEP-CALL')) throw new Error('POST sheet: call missing');
  if (!v.includes('releaseOrphanIOUs')) throw new Error('POST sheet: import missing');
  console.log('OK IOUBalanceSheetShare - orphan sweep runs on sheet load (.bak_orphan)');
}
