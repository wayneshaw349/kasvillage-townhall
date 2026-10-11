// wire_delist_both_heads.cjs — DELIST covers every head this game is listed
// under: the bundled manifest head AND the pinned TRUSTED_GAMES head (differ
// after a re-pin, e.g. 976b8c49 vs ef0c3a6f). One record + one local echo per
// head (~1 KAS each when they differ).
const fs = require('fs');
const F = 'Workspace.tsx';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('_heads')) { console.log('already patched'); process.exit(0); }

const A1 = "    const head = entry.bundle.manifest.head;";
const c1 = s.split(A1).length - 1;
if (c1 !== 1) { console.error('ANCHOR 1 count =', c1, '- expected 1. Aborting.'); process.exit(1); }
const B1 = `    const head = entry.bundle.manifest.head;
    const _heads: string[] = [head];
    try { const { TRUSTED_GAMES } = require('./game_chunks'); const th = (TRUSTED_GAMES as any)[gameId]; if (th && th !== head) _heads.push(th); } catch {}`;

const A2 = `          const res: any = await delistFromRegistry(owner, head, 'game');
          try { const _AS2 = require('@react-native-async-storage/async-storage').default; const dRaw = await _AS2.getItem('kv_game_delist_cache'); const arr = dRaw ? JSON.parse(dRaw) : []; arr.push({ delist: true, head, t: Date.now(), o: pub }); await _AS2.setItem('kv_game_delist_cache', JSON.stringify(arr)); gadd('local delist echo cached'); } catch {}`;
const c2 = s.split(A2).length - 1;
if (c2 !== 1) { console.error('ANCHOR 2 count =', c2, '- expected 1. Aborting.'); process.exit(1); }
const B2 = `          let res: any = null;
          for (const _h of _heads) {
            res = await delistFromRegistry(owner, _h, 'game');
            try { const _AS2 = require('@react-native-async-storage/async-storage').default; const dRaw = await _AS2.getItem('kv_game_delist_cache'); const arr = dRaw ? JSON.parse(dRaw) : []; arr.push({ delist: true, head: _h, t: Date.now(), o: pub }); await _AS2.setItem('kv_game_delist_cache', JSON.stringify(arr)); gadd('local delist echo cached ' + _h.slice(0, 8)); } catch {}
          }`;

s = s.replace(A1, B1).replace(A2, B2);
if (CRLF) s = s.replace(/\n/g, '\r\n');
fs.writeFileSync(F, s);
console.log('patched: DELIST posts a record + local echo for every listed head of the game');
