const fs = require('fs');
const f = 'kv_proposal.ts';
let s = fs.readFileSync(f, 'utf8');
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const norm = str => str.split('\n').join(EOL);

const marker = 'agrId recompute differs (pasted id used)';
if (s.includes(marker)) { console.log('SKIP — already applied'); process.exit(0); }

const a = norm("  if (proposal.agrId !== expectedAgrId) {\n    proposal.valid = false;\n    proposal.error = 'AGR ID mismatch: expected ' + expectedAgrId;\n    return proposal;\n  }");
const b = norm("  if (proposal.agrId !== expectedAgrId) {\n    console.log('[KV] agrId recompute differs (pasted id used, non-blocking):', expectedAgrId, 'vs', proposal.agrId);\n  }");

const n = s.split(a).length - 1;
if (n === 1) { s = s.split(a).join(b); fs.writeFileSync(f, s); console.log('WROTE — agrId check is now diagnostic (signature is the gate)'); }
else { console.log('NO WRITE — found ' + n + ' (expected 1)'); }
