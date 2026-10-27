// wire_streamer_link.cjs - the wallet's Streamer Mode switch also turns it on inside KasCity (and other games).
//   Passes window.__kvStreamer into the game page, and masks the contact in the "Contact player" alert.
//   node wire_streamer_link.cjs   (project folder; safe to run twice; backup OnChainPageView.tsx.bak_smlink)
const fs = require('fs');
const F = 'OnChainPageView.tsx', MARK = 'KV_STREAMER_LINK';
const HUNKS = [
  ["'try{window.KV_GRANTS=' + JSON.stringify((globalThis as any).__kvGrantsAll || {}) + '",
   "'try{window.__kvStreamer=' + ((globalThis as any).__kvStreamer === true ? 'true' : 'false') /* KV_STREAMER_LINK */ + ';window.KV_GRANTS=' + JSON.stringify((globalThis as any).__kvGrantsAll || {}) + '"],
  ["(url ? '' : '\\n\\nContact: ' + to)",
   "(url ? '' : '\\n\\nContact: ' + ((globalThis as any).__kvStreamer === true ? to.slice(0, 2) + '•••' + to.slice(-2) : to))"],
];
const raw = fs.readFileSync(F, 'utf8'); const crlf = /\r\n/.test(raw);
let t = crlf ? raw.replace(/\r\n/g, '\n') : raw;
if (t.includes(MARK)) { console.log('  done  ' + F + ' (already patched)'); process.exit(0); }
for (const [a, b] of HUNKS) { if (t.split(a).length !== 2) { console.log('  FAIL  missing: ' + a.slice(0, 70) + '\n  ' + F + ' left untouched'); process.exit(1); } t = t.replace(a, () => b); }
fs.writeFileSync(F + '.bak_smlink', raw);
fs.writeFileSync(F, crlf ? t.replace(/\n/g, '\r\n') : t);
console.log('  ok    ' + F + '\nDone. Restart Expo (npx expo start -c). Wallet Streamer Mode now carries into games opened after you switch it on.');
