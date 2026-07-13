const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let s = fs.readFileSync(f, 'utf8');

const a = 'frostCounter: (contract.frostData ? contract.frostData.frostCounter : undefined) ?? 0,';
const b = 'buyerPrivKeyHex: wallet.privKeyHex, frostCounter: (contract.frostData ? contract.frostData.frostCounter : undefined) ?? 0,';

const n = s.split(a).length - 1;
if (n === 1) { s = s.split(a).join(b); fs.writeFileSync(f, s); console.log('WROTE — buyerPrivKeyHex added to generateProposal'); }
else if (s.includes('buyerPrivKeyHex: wallet.privKeyHex, frostCounter')) { console.log('SKIP — already applied'); }
else { console.log('NO WRITE — found ' + n + ' (expected 1)'); }
