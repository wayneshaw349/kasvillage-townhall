const fs=require('fs');
// --- Props defaults: fix 11 tsc errors ---
let s=fs.readFileSync('IOUBalanceSheetShare.tsx','utf8');
s=s.replace("export function IOUBalanceSheetModal(props: Partial<Props> & { visible: boolean; onClose: () => void }) {","export function IOUBalanceSheetModal(rawProps: Partial<Props> & { visible: boolean; onClose: () => void }) {\n  const props = { frostAgreementId: '', frostTxId: '', frostAddress: '', myPubkey: '', myAddress: '', myCollateralSompi: 0n, counterpartyPubkey: '', counterpartyAddress: '', counterpartyCollateralSompi: 0n, ...rawProps };");
fs.writeFileSync('IOUBalanceSheetShare.tsx',s);
// --- utxo_ledger: release orphan locks ---
let u=fs.readFileSync('utxo_ledger.ts','utf8');
u=u.replace("const LEDGER_KEY = 'kv_utxo_ledger';","const LEDGER_KEY = 'kv_utxo_ledger';\n\nexport async function releaseOrphanCollateral(activeAgreementIds: string[]): Promise<number> {\n  const arr = await loadLedger();\n  let n = 0;\n  for (const e of arr) {\n    if ((e.status === 'collateral-committed' || e.status === 'collateral-locked') && (!e.agreementId || !activeAgreementIds.includes(e.agreementId))) { e.status = 'free'; e.agreementId = undefined; n++; }\n  }\n  await saveLedger(arr);\n  return n;\n}");
fs.writeFileSync('utxo_ledger.ts',u);console.log('done');
