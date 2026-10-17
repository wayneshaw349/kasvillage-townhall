// wire_game_flag_btn.cjs — Flag button inside the game descriptor modal (dapps lane games).
// Flags the listing's store address on the 'dapp' registry (tallied by rebuildDirectory).
// Run AFTER wire_flags.cjs (uses runFlag).
const fs = require('fs');
const F = 'VillageMailbox.tsx';
let s = fs.readFileSync(F, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
if (s.includes('KV_GAME_FLAG_BTN')) { console.log('already patched'); process.exit(0); }
const A = "                  descriptor {gameView.hash.slice(0, 16)}... on Kaspa L1\n                </Text>\n";
const c = s.split(A).length - 1;
if (c !== 1) { console.error('ANCHOR count =', c, '- expected 1'); process.exit(1); }
if (!s.includes('const runFlag = async')) { console.error('runFlag missing - run wire_flags.cjs first'); process.exit(1); }
const B = A + `                {/* KV_GAME_FLAG_BTN */}
                {(() => { const _fi = ((globalThis as any).__kvFlagInfo || new Map()).get(String(gameView.addr)); return _fi && _fi.n ? (
                  <Text style={{ color: '#92400e', backgroundColor: '#fef3c7', fontSize: rs.font(10), fontWeight: 'bold', textAlign: 'center', borderRadius: rs.s(8), padding: rs.s(6), marginBottom: rs.s(8) }}>{'\\u2691 Flagged ' + _fi.n + '/3 \\u2014 ' + _fi.reasons.join(', ')}</Text>
                ) : null; })()}
                <TouchableOpacity onPress={() => runFlag({ arweaveTx: gameView.addr, id: gameView.addr, name: gameView.name } as any, 'dapp')} style={{ alignSelf: 'center', borderWidth: 1, borderColor: '#d97706', borderRadius: rs.s(10), paddingVertical: rs.s(5), paddingHorizontal: rs.s(12), marginBottom: rs.s(10) }}>
                  <Text style={{ color: '#d97706', fontSize: rs.font(10), fontWeight: 'bold' }}>Flag this game (0.1 KAS)</Text>
                </TouchableOpacity>
`;
s = s.split(A).join(B);
fs.writeFileSync(F, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log('patched: Flag button + flag badge in the game descriptor modal');
