const fs = require('fs');
const f = 'kv_proposal.ts';
let s = fs.readFileSync(f, 'utf8');

const marker = 'proposal.buyerR.length > 0) secp256k1.ProjectivePoint.fromHex';
if (s.includes(marker)) { console.log('SKIP — already applied'); process.exit(0); }

const a = 'secp256k1.ProjectivePoint.fromHex(proposal.buyerR);';
const b = 'if (proposal.buyerR && proposal.buyerR.length > 0) secp256k1.ProjectivePoint.fromHex(proposal.buyerR); // R is a ceremony value (step 5), empty at proposal time (step 3)';

const n = s.split(a).length - 1;
if (n === 1) { s = s.split(a).join(b); fs.writeFileSync(f, s); console.log('WROTE — R validated only when present (empty R allowed at proposal time)'); }
else { console.log('NO WRITE — found ' + n + ' (expected 1)'); }
