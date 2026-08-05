// add_402_diag.cjs — log final URL + redirect flag on upload failure (who served the 402?)
const fs = require('fs');
const p = 'avatar_arweave_upload.ts';
let s = fs.readFileSync(p, 'utf8');
const old = 'console.error(`[Arweave] Upload failed ${response.status}: ${text}`);';
const neu = 'console.error(`[Arweave] Upload failed ${response.status} from ${(response as any).url} redirected=${(response as any).redirected}: ${text.slice(0,200)}`);';
const n = s.split(old).length - 1;
if (n !== 1) { console.error('FAIL — anchor count ' + n); process.exit(1); }
fs.copyFileSync(p, p + '.bak2');
fs.writeFileSync(p, s.replace(old, neu));
console.log('OK diag added');
