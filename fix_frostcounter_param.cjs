const fs = require('fs');
const f = 'kv_proposal.ts';
let s = fs.readFileSync(f, 'utf8');
const EOL = s.includes('\r\n') ? '\r\n' : '\n';

// Target ONLY the generateProposal param block: the verificationCode+description
// pair that ends the params object, then '}): string {'.
const a = ['  verificationCode: string;','  description: string;','}): string {'].join(EOL);
const b = ['  verificationCode: string;','  description: string;','  frostCounter?: number;','}): string {'].join(EOL);

if (s.includes(b)) { console.log('SKIP — already applied'); process.exit(0); }
const n = s.split(a).length - 1;
if (n === 1) { s = s.split(a).join(b); fs.writeFileSync(f, s); console.log('WROTE — frostCounter added to generateProposal params'); }
else { console.log('NO WRITE — found ' + n + ' (expected 1)'); }
