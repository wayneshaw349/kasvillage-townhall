// fix_game_view_reset.cjs — retire the CSS rotate/zoom simulation for chain games.
// Real landscape (expo-screen-orientation) now provides orientation, so in game mode
// every applyView call is coerced to r=false, z=1: upright, 1:1, taps land where they look.
// This also overwrites the stale kv_view_<head> entry on the next apply.
// Pages (non-game) keep the rotate/zoom controls unchanged.
const fs = require('fs');
const F = 'OnChainPageView.tsx';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('KV_GAME_VIEW_RESET')) { console.log('already patched'); process.exit(0); }

const A = "  const applyView = (r: boolean, z: number) => {\n    webRef.current?.injectJavaScript(KV_ROT_JS.replace('__R__', r ? '1' : '0').replace('__S__', String(z)));";
const c = s.split(A).length - 1;
if (c !== 1) { console.error('ANCHOR count =', c, '- expected 1. Aborting.'); process.exit(1); }

const B = "  const applyView = (r: boolean, z: number) => {\n    if (props.game) { r = false; z = 1; } // KV_GAME_VIEW_RESET: real landscape owns rotation; CSS sim retired for games\n    webRef.current?.injectJavaScript(KV_ROT_JS.replace('__R__', r ? '1' : '0').replace('__S__', String(z)));";

s = s.replace(A, B);
if (CRLF) s = s.replace(/\n/g, '\r\n');
fs.writeFileSync(F, s);
console.log('patched: game mode forces upright 1:1 view; pages unchanged');
