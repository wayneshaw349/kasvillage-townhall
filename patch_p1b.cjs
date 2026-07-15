// patch_p1b.cjs — Phase 1b: proposer writes KV-TimeoutN
// Run: node patch_p1b.cjs
const fs = require('fs');

function esc(x){ return x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function rx(a){ return new RegExp(esc(a).replace(/\n/g, '\\r?\\n'), 'g'); }

const files = {};
function load(f){ files[f] = fs.readFileSync(f, 'utf8'); }
function guard(f, name, a, expect){
  const c = (files[f].match(rx(a)) || []).length;
  if (c !== expect) { console.error('ABORT ['+name+'] '+f+' count='+c+' expected='+expect); process.exit(1); }
  console.log('OK ['+name+'] '+f+' count='+c);
}
function sub(f, name, a, r){ files[f] = files[f].replace(rx(a), () => r); console.log('APPLIED ['+name+']'); }

const TC = 'townhall_client.ts';
const NA = 'NeighborAgreement.tsx';
load(TC); load(NA);

// ---------- townhall_client.ts : proposeAgreement params ----------
const T1 = "  frostR?: string;\n  daaScore?: number;\n}): Promise<{ success: boolean; agreementId?: string; error?: string; arweaveTxId?: string }> {";
// ---------- townhall_client.ts : dual-write pass-through ----------
const T2 = "        buyerAmountSompi: (params as any).buyerAmountSompi || 0,\n        sellerAmountSompi: (params as any).sellerAmountSompi || 0,\n      });\n    if (arweaveResult?.txId) { result.arweaveTxId = arweaveResult.txId; console.log('[TownHall] Arweave TX ID:', arweaveResult.txId); }";
// ---------- NeighborAgreement.tsx : proposer call site ----------
const N1 = "              daaScore: currentDaa,\n              buyerAmountSompi: Math.floor(contract.itemPriceKas * 1e8),\n              sellerAmountSompi: Math.floor(contract.sellerCommitmentKas * 1e8),\n            } as any);";

guard(TC,'T1 propose params',T1,1);
guard(TC,'T2 dual-write',T2,1);
guard(NA,'N1 propose call',N1,1);

sub(TC,'T1',T1,"  frostR?: string;\r\n  daaScore?: number;\r\n  timeoutN?: number;\r\n}): Promise<{ success: boolean; agreementId?: string; error?: string; arweaveTxId?: string }> {");
sub(TC,'T2',T2,"        buyerAmountSompi: (params as any).buyerAmountSompi || 0,\r\n        sellerAmountSompi: (params as any).sellerAmountSompi || 0,\r\n        timeoutN: (params as any).timeoutN || 0,\r\n      });\r\n    if (arweaveResult?.txId) { result.arweaveTxId = arweaveResult.txId; console.log('[TownHall] Arweave TX ID:', arweaveResult.txId); }");
sub(NA,'N1',N1,"              daaScore: currentDaa,\r\n              buyerAmountSompi: Math.floor(contract.itemPriceKas * 1e8),\r\n              sellerAmountSompi: Math.floor(contract.sellerCommitmentKas * 1e8),\r\n              timeoutN: Math.floor((contract.timeoutMinutes || 5) * 60),\r\n            } as any);");

for (const f of [TC, NA]) { fs.writeFileSync(f, files[f]); console.log('WROTE ' + f); }
