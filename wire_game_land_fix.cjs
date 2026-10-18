// wire_game_land_fix.cjs - wallet side for games built in landscape (kascity_landscape.cjs).
//  - rotate-button OFF now also tells the game's own landscape code to stay portrait (window.__kvLandOff)
//  - the game's internal "ready" signal is no longer shown as "Unsupported link: ready"
// Run after wire_game_landscape_v2.cjs.
const fs = require('fs');
const f = 'OnChainPageView.tsx';
let s = fs.readFileSync(f, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
if (s.includes('KV_LAND_FIX')) { console.log(f + ': already patched - skipping'); process.exit(0); }
const edits = [
  ["injectedJavaScriptBeforeContentLoaded={(props.game && land && wv ? 'window.__kvRealW=' + Math.round(wv.w) + ';window.__kvRealH=' + Math.round(wv.h) + ';' + KV_LAND_SHIM : '') + ",
   "injectedJavaScriptBeforeContentLoaded={(props.game && land && wv ? 'window.__kvRealW=' + Math.round(wv.w) + ';window.__kvRealH=' + Math.round(wv.h) + ';' + KV_LAND_SHIM : (props.game && land === false ? 'window.__kvLandOff=1;' : '')) /* KV_LAND_FIX */ + "],
  ["      if (msg.kv) handleKvLink(msg.kv);", "      if (msg.kv && msg.kv !== 'ready') handleKvLink(msg.kv);"],
];
for (let i = 0; i < edits.length; i++) { const c = s.split(edits[i][0]).length - 1; if (c !== 1) { console.error(f + ' ANCHOR ' + (i + 1) + ' count = ' + c + ' - expected 1 (run wire_game_landscape_v2.cjs first). Aborting - nothing written.'); process.exit(1); } }
for (const [a, b] of edits) s = s.split(a).join(b);
fs.writeFileSync(f, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log(f + ': patched - landscape-built games respect the rotate toggle; no more "Unsupported link: ready".');
