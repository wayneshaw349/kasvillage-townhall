// wire_game_card_flag.cjs — Flag button under DOWNLOAD on every Games-lane card.
// Tap -> reason popup (Scam / Prohibited / Spam / Stolen / Cancel) -> 0.1 KAS flag on the
// 'game' registry, keyed by the quad head (what the games-lane tally counts).
// Card also shows "Flagged n/3" when flags exist. Run AFTER wire_flags.cjs + wire_game_flags.cjs.
const fs = require('fs');
const F = 'VillageMailbox.tsx';
let s = fs.readFileSync(F, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
if (s.includes('KV_GAME_CARD_FLAG')) { console.log('already patched'); process.exit(0); }
const edits = [
  ["  const runDelistOwner = async (entry: any, kind: string) => {",
   "  (globalThis as any).__kvRunFlag = runFlag; // KV_GAME_CARD_FLAG: game cards (separate component) reach runFlag\n  const runDelistOwner = async (entry: any, kind: string) => {"],
  ["      </TouchableOpacity>\n      {item.quad && item.quad.tip_addr && onTip ? (",
   `      </TouchableOpacity>
      {/* KV_GAME_CARD_FLAG */}
      {(() => { const _fi = item.quad ? ((globalThis as any).__kvFlagInfo || new Map()).get(String(item.quad.head)) : null; return _fi && _fi.n ? (
        <Text style={{ marginTop: 6, color: '#92400e', backgroundColor: '#fef3c7', fontSize: 10, fontWeight: '700', borderRadius: 6, padding: 4, textAlign: 'center' }}>{'\\u2691 Flagged ' + _fi.n + '/3 \\u2014 ' + _fi.reasons.join(', ')}</Text>
      ) : null; })()}
      {item.quad ? (
        <TouchableOpacity onPress={() => { const f = (globalThis as any).__kvRunFlag; if (f) f({ arweaveTx: String(item.quad.head), id: String(item.quad.head), ownerPubkey: item.o || '', name: item.name || '' }, 'game'); }}
          style={{ marginTop: 6, borderColor: '#d97706', borderWidth: 1, borderRadius: 8, paddingVertical: 5, alignItems: 'center' }}>
          <Text style={{ color: '#d97706', fontWeight: '700', fontSize: 11 }}>Flag (0.1 KAS)</Text>
        </TouchableOpacity>
      ) : null}
      {item.quad && item.quad.tip_addr && onTip ? (`],
];
let ok = true;
for (const [a] of edits) { const c = s.split(a).length - 1; if (c !== 1) { console.error('ANCHOR count ' + c + ' expected 1: ' + a.slice(0, 50)); ok = false; } }
if (!s.includes('const runFlag = async')) { console.error('runFlag missing - run wire_flags.cjs first'); ok = false; }
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const [a, b] of edits) s = s.split(a).join(b);
fs.writeFileSync(F, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log('patched: Flag button + flag badge under DOWNLOAD on game cards');
