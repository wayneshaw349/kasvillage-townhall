// diag_reannounce.cjs — log what Re-announce sees: list size, and per
// abstract whether it has a title and a pledge nonce on this device.
const fs = require('fs');
const F = 'Workspace.tsx';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');
if (s.includes('KV_REANNOUNCE_DIAG')) { console.log('already patched'); process.exit(0); }

const A = "      const _batch: any[] = []; // KV_BATCH_REANNOUNCE\n      for (const _a of _list) {\n        const _nS = await AS.getItem('kv_abs_nonce_' + _a.id);";
const B = "      const _batch: any[] = []; // KV_BATCH_REANNOUNCE\n      console.log('[Academic] KV_REANNOUNCE_DIAG list:', _list.length);\n      for (const _a of _list) {\n        const _nS = await AS.getItem('kv_abs_nonce_' + _a.id);\n        console.log('[Academic] diag', _a.id, 'title:', JSON.stringify(String(_a.title || '').slice(0, 30)), 'nonce:', _nS || 'NONE');";
const c = s.split(A).length - 1;
if (c !== 1) { console.error('ANCHOR count =', c, '- expected 1. Aborting.'); process.exit(1); }
s = s.split(A).join(B);
fs.writeFileSync(F, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log('patched: re-announce diagnostics');
