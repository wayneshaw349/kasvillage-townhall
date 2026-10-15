// diag_academics.cjs — one-line diagnostics in fetchAcademics so the Metro
// log says exactly where entries vanish: how many directory entries came
// back from the chain, what categories they carry, and how many survived
// the academic filter.
const fs = require('fs');
const F = 'mailbox_kaspa_api.ts';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('KV_ACAD_DIAG')) { console.log('already patched'); process.exit(0); }

const A1 = "    dir.sort(visSort as any);\n    const items: AcademicEntry[] = (dir as any[])";
const c1 = s.split(A1).length - 1;
if (c1 !== 1) { console.error('ANCHOR 1 count =', c1, '- expected 1. Aborting.'); process.exit(1); }
const B1 = "    dir.sort(visSort as any);\n    console.log('[Academics] KV_ACAD_DIAG dir:', dir.length, 'cats:', (dir as any[]).slice(0, 8).map((e: any) => String(e.category || '?')).join(','));\n    const items: AcademicEntry[] = (dir as any[])";

const A2 = "        } as any;\n      });\n    return { items, hasMore: false, fromCache: false };";
const c2 = s.split(A2).length - 1;
if (c2 !== 1) { console.error('ANCHOR 2 count =', c2, '- expected 1. Aborting.'); process.exit(1); }
const B2 = "        } as any;\n      });\n    console.log('[Academics] matched:', items.length, items.map((i: any) => (i.title || '(untitled)') + '/' + (i.institution || '-')).join(' | '));\n    return { items, hasMore: false, fromCache: false };";

s = s.split(A1).join(B1).split(A2).join(B2);
fs.writeFileSync(F, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log('patched: fetchAcademics now reports dir size, categories, and matches');
