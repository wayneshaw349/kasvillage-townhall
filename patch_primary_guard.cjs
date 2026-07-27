const fs=require('fs');const F='utxo_ledger.ts';let s=fs.readFileSync(F,'utf8');
if(s.includes('PRIMARY-GUARD')){console.log('already patched');process.exit(0);}
fs.writeFileSync(F+'.bak_primary',s);
const A="export async function syncLedger(address: string): Promise<SpendableResult> {\n  const apiBase = await getApiBase();\n  const resp = await fetch(`${apiBase}/addresses/${address}/utxos`);\n  if (!resp.ok) throw new Error('UTXO fetch failed: ' + resp.status);\n  const rawUtxos: any[] = await resp.json();\n\n  const ledger = await loadLedger();";
const Acr=A.replace(/\n/g,'\r\n');
const B="export async function syncLedger(address: string): Promise<SpendableResult> {\n  const apiBase = await getApiBase();\n  const resp = await fetch(`${apiBase}/addresses/${address}/utxos`);\n  if (!resp.ok) throw new Error('UTXO fetch failed: ' + resp.status);\n  const rawUtxos: any[] = await resp.json();\n\n  // PRIMARY-GUARD: only the primary (hot) wallet address may read/write the\n  // persisted ledger. Any other address (vault, counterparty) gets an\n  // ephemeral in-memory ledger so it can never clobber hot state.\n  let isPrimary = true;\n  try {\n    const primary = (await SecureStore.getItemAsync('kv_kaspa_address'))\n      || (await SecureStore.getItemAsync('kaspa_address')) || '';\n    if (primary && address !== primary) isPrimary = false;\n  } catch {}\n\n  const ledger = isPrimary ? await loadLedger() : new Map<string, LedgerEntry>();";
const Bcr=B.replace(/\n/g,'\r\n');
if(s.includes(A)) s=s.replace(A,B);
else if(s.includes(Acr)) s=s.replace(Acr,Bcr);
else {console.error('anchor1 abort');process.exit(1);}

const C="  await saveLedger(ledger);\n  return computeBalances(ledger);\n}";
const Ccr=C.replace(/\n/g,'\r\n');
const D="  if (isPrimary) await saveLedger(ledger);\n  return computeBalances(ledger);\n}";
const Dcr=D.replace(/\n/g,'\r\n');
if(s.includes(C)) s=s.replace(C,D);
else if(s.includes(Ccr)) s=s.replace(Ccr,Dcr);
else {console.error('anchor2 abort - restoring');fs.writeFileSync(F,fs.readFileSync(F+'.bak_primary','utf8'));process.exit(1);}
fs.writeFileSync(F,s);console.log('patched ok');
