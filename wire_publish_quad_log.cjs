// wire_publish_quad_log.cjs — at announce time, print the full quad to Metro AND
// stash it in AsyncStorage (kv_last_publish_quad) so the coordinates are saved
// on the PC console the moment you publish — no game launch needed for walk_check.
// Anchor: the quad construction in Workspace.tsx (post fix_quad_tip state).
const fs = require('fs');
const F = 'Workspace.tsx';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('[KV] PUBLISH QUAD')) { console.log('already patched'); process.exit(0); }

const A = "      const quad = { game: gameId, manifestAddress, manifestHash, head: m.head, tip_addr: myAddr, ...daaSpan };";
const c = s.split(A).length - 1;
if (c !== 1) { console.error('ANCHOR count =', c, '- expected 1. Paste the quad-construction region of Workspace.tsx and I will re-anchor. Aborting.'); process.exit(1); }

const INS = A + "\n      try { console.log('[KV] PUBLISH QUAD ' + JSON.stringify(quad)); const AS = require('@react-native-async-storage/async-storage').default; AS.setItem('kv_last_publish_quad', JSON.stringify(quad)); } catch {}";

s = s.replace(A, INS);
if (CRLF) s = s.replace(/\n/g, '\r\n');
fs.writeFileSync(F, s);
console.log('patched: [KV] PUBLISH QUAD logs + saved to kv_last_publish_quad at announce time');
