const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let s = fs.readFileSync(f, 'utf8');
let ok = true, log = [];

// EDIT 1: regex, CRLF-tolerant. Anchor = the Seller L1 loop comment, then the declaration.
const re1 = /(\/\/ Seller L1 loop: same algorithm as buyer, no relay dependency\r?\n\s*)let frostData: any = null;/;
if (re1.test(s)) {
  s = s.replace(re1, '$1let frostData: any = canon.frostData || null; /* PASTE-ONLY: use canon address, skip L1 scan */');
  log.push('OK    edit1 (canon seed)');
} else if (s.includes('let frostData: any = canon.frostData')) {
  log.push('SKIP  edit1 already applied');
} else { ok = false; log.push('MISS  edit1 anchor not found'); }

// EDIT 2: plain single-line, idempotent.
const a2 = 'if (agrFrostAddr && agrFrostAddr.length > 20) {';
const b2 = 'if (!frostData && agrFrostAddr && agrFrostAddr.length > 20) {';
if (s.split(a2).length - 1 === 1) { s = s.split(a2).join(b2); log.push('OK    edit2 (reuse guard)'); }
else if (s.includes(b2)) { log.push('SKIP  edit2 already applied'); }
else { ok = false; log.push('MISS  edit2'); }

if (ok) { fs.writeFileSync(f, s); console.log('WROTE FILE'); }
else { console.log('NO WRITE:'); }
log.forEach(l => console.log('  ' + l));
