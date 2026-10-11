// wire_head_supersede.cjs — launches honor the pin even when the installed record
// carries a superseded head. 976b8c49… (v234, broke rotate) is remapped to
// ef0c3a6f… (known-good) right at the fetch call, so gameCacheLoadOffline hits
// kv_games/ef0c3a6f….html and the old build plays from cache.
const fs = require('fs');
const F = 'OnChainPageView.tsx';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('KV_HEAD_SUPERSEDE')) { console.log('already patched'); process.exit(0); }

const A1 = "import { fetchGamePuzzle, TRUSTED_GAMES, GameManifest } from './game_chunks';";
const A2 = "        ? await fetchGamePuzzle(props.game.manifestAddress, props.game.manifestHash, props.game.head, network,";
const c1 = s.split(A1).length - 1;
const c2 = s.split(A2).length - 1;
if (c1 !== 1 || c2 !== 1) { console.error('ANCHOR counts =', c1, c2, '- expected 1,1. Aborting.'); process.exit(1); }

const MAP = A1 + "\n\n// KV_HEAD_SUPERSEDE: launch the pinned build even when an installed record carries a superseded head.\nconst KV_HEAD_SUPERSEDE: Record<string, string> = {\n  '976b8c49712ee5fd1e00a33e1042f6fd5ac24f3c135b4e1fca3a80010e476805':\n    'ef0c3a6ff34488044747589b3ee301c238879f496f60bf7bfb6c9fa7292ff63a',\n};";
s = s.replace(A1, MAP);

const CALL = "        ? await fetchGamePuzzle(props.game.manifestAddress, props.game.manifestHash, (KV_HEAD_SUPERSEDE[props.game.head] || props.game.head), network,";
s = s.replace(A2, CALL);

if (CRLF) s = s.replace(/\n/g, '\r\n');
fs.writeFileSync(F, s);
console.log('patched: 976b8c49... launches remap to ef0c3a6f... (cache-first)');
