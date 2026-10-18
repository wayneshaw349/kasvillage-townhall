// fix_unlisted_games_only.cjs — keep the UNLISTED toggle + SEND BOARD for GAMES only.
// Removes the send/unlisted gate that wire_send_board put before store / academic / dapp
// announces (they announce exactly as before); keeps it before the two 'Game','game' announces.
const fs = require('fs');
const F = 'Workspace.tsx';
let s = fs.readFileSync(F, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
if (s.includes('KV_PUBLISH_PRIVATE')) { console.error('fix_publish_private.cjs was applied - this patch is for the UNLISTED-toggle version. Stop.'); process.exit(1); }
const GATE_RE = /^[ \t]*\/\/ KV_SEND_GATE:[^\n]*\n[\s\S]*?^[ \t]*setGbusy\(''\); return;\n[ \t]*\}\n(?=([^\n]*)\n)/gm;
let kept = 0, removed = 0;
s = s.replace(GATE_RE, (block, nextLine) => {
  if (nextLine.includes("'Game', 'game'")) { kept++; return block; }
  removed++; return '';
});
if (!kept && !removed) { console.log('no gates found - nothing to do'); process.exit(0); }
fs.writeFileSync(F, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log('patched: kept ' + kept + ' game gate(s), removed ' + removed + ' from store/academic/dapp announces');
