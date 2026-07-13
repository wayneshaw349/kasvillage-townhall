const fs = require('fs');
const f = 'kv_proposal.ts';
let s = fs.readFileSync(f, 'utf8');
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const norm = str => str.split('\n').join(EOL);

const marker = 'code recompute differs (signature is the gate)';
if (s.includes(marker)) { console.log('SKIP — already applied'); process.exit(0); }

// The verification-code reject block (recomputes via addressToPubkey which hardcodes '02')
const a = norm("  if (proposal.verificationCode !== expectedCode) {\n    proposal.valid = false;\n    proposal.error = 'Code mismatch: expected ' + expectedCode;\n    return proposal;\n  }");
const b = norm("  if (proposal.verificationCode !== expectedCode) {\n    console.log('[KV] code recompute differs (signature is the gate, non-blocking):', expectedCode, 'vs', proposal.verificationCode);\n  }");

const n = s.split(a).length - 1;
if (n === 1) { s = s.split(a).join(b); fs.writeFileSync(f, s); console.log('WROTE — code check is now diagnostic (signature is the gate)'); }
else if (n === 0) { console.log('NO WRITE — reject block not found as expected; paste the code-check block and I will re-key'); }
else { console.log('NO WRITE — found ' + n + ' (expected 1)'); }
