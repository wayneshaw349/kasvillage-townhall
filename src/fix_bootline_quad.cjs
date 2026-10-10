// fix_bootline_quad.cjs — log the full quad on every game launch (Metro console).
// Anchor: the fetchHtmlPage fallback line in OnChainPageView.tsx (~line 156).
const fs = require('fs');
const F = 'OnChainPageView.tsx';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes("[KV] QUAD")) { console.log('already patched'); process.exit(0); }

const A = "        : await fetchHtmlPage(storeAddress, pageHash, network, (props as any).coords);";
const c = s.split(A).length - 1;
if (c !== 1) { console.error('ANCHOR count =', c, '- expected 1. Aborting.'); process.exit(1); }

const INS = A + "\n      try { const _q: any = props.game; if (_q && _q.head) console.log('[KV] QUAD ' + JSON.stringify({ head: _q.head, anchor_hash: _q.anchor_hash, daa_from: _q.daa_from, daa_to: _q.daa_to, manifestAddress: _q.manifestAddress, manifestHash: _q.manifestHash })); } catch {}";

s = s.replace(A, INS);
if (CRLF) s = s.replace(/\n/g, '\r\n');
fs.writeFileSync(F, s);
console.log('patched: [KV] QUAD logs on every game launch');
