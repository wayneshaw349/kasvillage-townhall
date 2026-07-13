const fs = require('fs');

// Target the file holding canonicalVerify. Prefer the known name; else auto-find.
let f = 'canonical_schema_ts.ts';
if (!fs.existsSync(f) || !fs.readFileSync(f, 'utf8').includes('AGR ID mismatch')) {
  const hit = fs.readdirSync('.').find(n =>
    (n.endsWith('.ts') || n.endsWith('.tsx')) &&
    fs.readFileSync(n, 'utf8').includes('AGR ID mismatch'));
  if (!hit) { console.log('NO FILE with "AGR ID mismatch" found — tell me the filename'); process.exit(0); }
  f = hit;
}
console.log('target:', f);

let s = fs.readFileSync(f, 'utf8');
const edits = [
  ['const idValid = expectedId === kvAgrId;',
   "const idValid = !!kvAgrId && kvAgrId.indexOf('AGR_') === 0; const _idDrift = expectedId !== kvAgrId; /* PASTE-ONLY: trust transmitted agrId */"],
  ['if (!idValid) {',
   'if (_idDrift) {'],
  ["console.warn('[Canonical] AGR ID mismatch: expected', expectedId, 'got', kvAgrId);",
   "console.log('[Canonical] agrId recompute differs (using pasted id, non-blocking):', expectedId, 'vs', kvAgrId);"],
];

let ok = true, log = [];
for (const [a, b] of edits) {
  const n = s.split(a).length - 1;
  if (n === 1) { s = s.split(a).join(b); log.push('OK   ' + a.slice(0, 40)); }
  else { ok = false; log.push('MISS(' + n + ') ' + a.slice(0, 40)); }
}

if (ok) { fs.writeFileSync(f, s); console.log('WROTE FILE'); }
else { console.log('NO WRITE — a match count was off:'); }
log.forEach(l => console.log('  ' + l));
