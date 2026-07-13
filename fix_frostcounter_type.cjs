const fs = require('fs');
const f = 'kv_proposal.ts';
let s = fs.readFileSync(f, 'utf8');
const marker = 'frostCounter?: number;';
if (s.includes(marker)) { console.log('SKIP — already applied'); process.exit(0); }

const a = 'buyerPrivKeyHex?: string;\n  buyerPubkey?: string;\n  agrId: string;';
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const A = a.split('\n').join(EOL);
const B = ('buyerPrivKeyHex?: string;\n  buyerPubkey?: string;\n  frostCounter?: number;\n  agrId: string;').split('\n').join(EOL);

const n = s.split(A).length - 1;
if (n === 1) { s = s.split(A).join(B); fs.writeFileSync(f, s); console.log('WROTE — frostCounter added to generateProposal params'); }
else { console.log('NO WRITE — found ' + n + ' (expected 1)'); }
