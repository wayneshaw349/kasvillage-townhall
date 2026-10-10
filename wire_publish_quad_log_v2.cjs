// wire_publish_quad_log_v2.cjs — at BOTH announce sites in Workspace.tsx, print the
// full quad to Metro ([KV] PUBLISH QUAD) and save it to AsyncStorage (kv_last_publish_quad)
// the moment you press announce — coordinates captured at the source for walk_check.
const fs = require('fs');
const F = 'Workspace.tsx';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('[KV] PUBLISH QUAD')) { console.log('already patched'); process.exit(0); }

const A1 = "      const quad = { game: gameId, manifestAddress, manifestHash, head: m.head, ...(tipOn ? { tip_addr: myAddr } : {}), ...daaSpan };";
const A2 = "        const quad = { game: gameId, manifestAddress, manifestHash: res.manifestHash, head: m.head, ...(tipOn ? { tip_addr: myAddr } : {}), ...daaSpan };";

const c1 = s.split(A1).length - 1;
const c2 = s.split(A2).length - 1;
if (c1 !== 1 || c2 !== 1) { console.error('ANCHOR counts =', c1, c2, '- expected 1,1. Aborting.'); process.exit(1); }

const LOG = (ind) => "\n" + ind + "try { console.log('[KV] PUBLISH QUAD ' + JSON.stringify(quad)); const _AS = require('@react-native-async-storage/async-storage').default; _AS.setItem('kv_last_publish_quad', JSON.stringify(quad)); } catch {}";

s = s.replace(A1, A1 + LOG('      '));
s = s.replace(A2, A2 + LOG('        '));
if (CRLF) s = s.replace(/\n/g, '\r\n');
fs.writeFileSync(F, s);
console.log('patched both announce sites: [KV] PUBLISH QUAD logs + kv_last_publish_quad saved');
