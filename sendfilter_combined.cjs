const fs=require('fs');
// 1. utxo_ledger: add helper
let u=fs.readFileSync('utxo_ledger.ts','utf8');
if(!u.includes('getFreeUtxoKeys')){
  u=u.replace("export async function syncLedger(address: string): Promise<SpendableResult> {","export async function getFreeUtxoKeys(address: string): Promise<Set<string>> {\n  const r = await syncLedger(address);\n  return new Set(r.utxos.map(e => e.utxoKey));\n}\n\nexport async function syncLedger(address: string): Promise<SpendableResult> {");
  fs.writeFileSync('utxo_ledger.ts',u);
}
// 2. kaspa_rest_tx: insert filter block after UTXO fetch
let s=fs.readFileSync('kaspa_rest_tx.ts','utf8');
const anchor="if (!utxos.length) return { success: false, error: 'No UTXOs available' };";
if(s.indexOf(anchor)<0){console.log('ANCHOR FAIL');process.exit(1);}
const insert=anchor+"\n\n    // Filter to ledger-free UTXOs (exclude collateral + IOU-backed)\n    try {\n      const { getFreeUtxoKeys } = await import('./utxo_ledger');\n      const freeKeys = await getFreeUtxoKeys(senderAddress);\n      if (freeKeys && freeKeys.size > 0) {\n        const before = utxos.length;\n        const filtered = utxos.filter(u => freeKeys.has(`${(u as any).outpoint?.transactionId || (u as any).transactionId}:${(u as any).outpoint?.index ?? (u as any).index ?? 0}`));\n        if (filtered.length > 0) { utxos.length = 0; utxos.push(...filtered); console.log('[REST-TX] Ledger filter:', before, '->', utxos.length, 'free'); }\n      }\n    } catch (e) { console.warn('[REST-TX] Ledger filter skipped:', e); }";
s=s.replace(anchor,insert);
fs.writeFileSync('kaspa_rest_tx.ts',s);console.log('done');
