const fs=require('fs');
// 1. parser: read frostCounter from parts[11]
let k=fs.readFileSync('kv_proposal.ts','utf8');
if(!k.includes('frostCounter: parts')){
  k=k.replace("    buyerPubkeyRaw: parts[10] || '',\n  };","    buyerPubkeyRaw: parts[10] || '',\n    frostCounter: (parts[11] !== undefined && parts[11] !== '') ? parseInt(parts[11], 10) : undefined,\n  };");
  fs.writeFileSync('kv_proposal.ts',k);
  console.log('parser fixed');
} else console.log('parser already ok');
// 2. buyer caller: pass frostCounter into generateProposal
let n=fs.readFileSync('NeighborAgreement.tsx','utf8');
if(!n.includes("frostCounter: (contract.frostData as any)?.frostCounter")){
  n=n.replace("                            buyerPubkey: contract.buyerPubkey || '',\n                            description: (contract.itemDescription || '') + (contract.shippingCenter ? ' - Ship to: ' + contract.shippingCenter : ''),\n                          });","                            buyerPubkey: contract.buyerPubkey || '',\n                            frostCounter: (contract.frostData as any)?.frostCounter ?? 0,\n                            description: (contract.itemDescription || '') + (contract.shippingCenter ? ' - Ship to: ' + contract.shippingCenter : ''),\n                          });");
  fs.writeFileSync('NeighborAgreement.tsx',n);
  console.log('caller fixed');
} else console.log('caller already ok');
