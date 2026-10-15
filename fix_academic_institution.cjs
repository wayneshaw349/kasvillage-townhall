// fix_academic_institution.cjs — fetchAcademics maps institution from
// d.institution, which announces never carry; the DKIM-verified school is in
// d.dkimDomain. Fall back to it so "rutgers" (etc.) is searchable and the
// card shows the institution.
const fs = require('fs');
const F = 'mailbox_kaspa_api.ts';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('KV_ACAD_INST')) { console.log('already patched'); process.exit(0); }

const A = "          institution: String((e.record && e.record.d && e.record.d.institution) || ''),";
const c = s.split(A).length - 1;
if (c !== 1) { console.error('ANCHOR count =', c, '- expected 1. Aborting.'); process.exit(1); }
const B = "          institution: String((e.record && e.record.d && (e.record.d.institution || e.record.d.dkimDomain)) || ''), // KV_ACAD_INST: DKIM school is the institution";

s = s.split(A).join(B);
fs.writeFileSync(F, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log('patched: institution falls back to dkimDomain (searchable by school)');
