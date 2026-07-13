const fs=require('fs');let n=fs.readFileSync('NeighborAgreement.tsx','utf8');
n=n.replace("buyerAmountSompi: Math.floor((canon?.buyerAmountSompi || 0)),","buyerAmountSompi: Math.floor((contract.itemPriceKas || 0) * 1e8),");
n=n.replace("sellerAmountSompi: Math.floor((canon?.sellerAmountSompi || 0)),","sellerAmountSompi: Math.floor((contract.sellerCommitmentKas || 0) * 1e8),");
n=n.replace("useState<'release' | 'cancel'>('release');","useState<'release' | 'cancel' | 'split'>('release');");
fs.writeFileSync('NeighborAgreement.tsx',n);console.log('done');
