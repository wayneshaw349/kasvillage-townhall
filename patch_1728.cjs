// patch_1728.cjs — coerce releaseExplorerUrl so it matches Contract's string field
const fs = require('fs');
const F = 'NeighborAgreement.tsx';
let s = fs.readFileSync(F, 'utf8');
const ORIG = s;

const A = "setContract(prev => ({ ...prev, releaseTxId: result.txId, releaseExplorerUrl: result.explorerUrl }));";
const B = "setContract(prev => ({ ...prev, releaseTxId: result.txId || '', releaseExplorerUrl: result.explorerUrl || '' }));";

if (s.includes(B)) { console.log('already patched'); process.exit(0); }
const c = s.split(A).length - 1;
if (c !== 1) { console.error('anchor count=' + c + ' — abort'); process.exit(1); }
fs.writeFileSync(F + '.bak_1728', ORIG);
s = s.replace(A, B);
fs.writeFileSync(F, s);
console.log('patched ok');
