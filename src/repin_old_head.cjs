// repin_old_head.cjs — point TRUSTED_GAMES back at the known-good build.
// 976b8c49… (v234 republish: broke rotate) -> ef0c3a6f… (rotate good; music fix is
// wallet-side KV_AUDIO_KEEP, so the old build gets it free). Device cache likely
// still holds kv_games/ef0c3a6f….html, so it plays instantly.
const fs = require('fs');
const F = 'game_chunks.ts';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

const NEW = '976b8c49712ee5fd1e00a33e1042f6fd5ac24f3c135b4e1fca3a80010e476805';
const OLD = 'ef0c3a6ff34488044747589b3ee301c238879f496f60bf7bfb6c9fa7292ff63a';

if (s.includes("'kascity-414-chain': '" + OLD + "'")) { console.log('already pinned to old head'); process.exit(0); }
const A = "'kascity-414-chain': '" + NEW + "'";
const c = s.split(A).length - 1;
if (c !== 1) { console.error('ANCHOR count =', c, '- expected 1 (kascity-414-chain with new head). Aborting.'); process.exit(1); }

s = s.replace(A, "'kascity-414-chain': '" + OLD + "'");
if (CRLF) s = s.replace(/\n/g, '\r\n');
fs.writeFileSync(F, s);
console.log('re-pinned kascity-414-chain: 976b8c49... -> ef0c3a6f...');
