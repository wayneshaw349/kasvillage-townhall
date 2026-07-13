const fs=require('fs');
let u=fs.readFileSync('utxo_ledger.ts','utf8');
u=u.replace("if ((e.status === 'collateral-committed' || e.status === 'collateral-locked') && (!e.commitReason","if ((e.status === 'iou-allocated' || e.status === 'collateral-committed' || e.status === 'collateral-locked') && (!e.commitReason");
fs.writeFileSync('utxo_ledger.ts',u);
let d=fs.readFileSync('Dashboard.tsx','utf8');
d=d.replace("let spendableBalanceSompi = 0n;","let spendableBalanceSompi = 0n;\n      try { const { releaseOrphanCollateral } = require('./utxo_ledger'); const n = await releaseOrphanCollateral([]); if (n > 0) console.log('[DashStats] freed', n, 'orphan UTXOs'); } catch {}");
fs.writeFileSync('Dashboard.tsx',d);console.log('done');
