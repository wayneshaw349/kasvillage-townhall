// fix_close_glyph.cjs — the close button rendered the literal text "\u2715"
// because the escape sat in JSX text, not a JS string. Wrap it.
const fs = require('fs');
const F = 'VillageMailbox.tsx';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

const A = ">\\u2715</Text>";
const c = s.split(A).length - 1;
if (c !== 1) { console.error('ANCHOR count =', c, '- expected 1. Aborting.'); process.exit(1); }
s = s.split(A).join(">{'\\u2715'}</Text>");
fs.writeFileSync(F, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log('patched: close button shows a real X');
