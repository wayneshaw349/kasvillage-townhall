// wire_game_view_fix3.cjs - landscape games were sized ~26px too big: the game measured the whole player
// area INCLUDING the green "On-chain page" bar under it, so the right edge of the sideways game (ROLL,
// P2/P4 cards) slid under that bar. Now the bar is measured and taken off. Run after wire_game_view_fix2.cjs.
const fs = require('fs');
const f = 'OnChainPageView.tsx';
let s = fs.readFileSync(f, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
if (s.includes('KV_VIEW_FIX3')) { console.log(f + ': already patched - skipping'); process.exit(0); }
const edits = [
  ["  const [topPad, setTopPad] = useState<number | null>(null); // KV_VIEW_FIX2: keep games below the status bar\n",
   "  const [topPad, setTopPad] = useState<number | null>(null); // KV_VIEW_FIX2: keep games below the status bar\n  const [barH, setBarH] = useState<number | null>(null); const boxRef = useRef<any>(null); // KV_VIEW_FIX3: game area excludes the verified bar\n"],
  ["      const done = (pad: number) => { const h = L.height - pad; setTopPad(pad); if (!wv || Math.abs(wv.w - L.width) > 1 || Math.abs(wv.h - h) > 1) setWv({ w: L.width, h }); };",
   "      const done = (pad: number) => { boxRef.current = { w: L.width, h: L.height, pad }; setTopPad(pad); if (barH == null) return; const h = L.height - pad - barH; if (!wv || Math.abs(wv.w - L.width) > 1 || Math.abs(wv.h - h) > 1) setWv({ w: L.width, h }); };"],
  ["      <View style={styles.verifiedBar}>",
   "      <View style={styles.verifiedBar} onLayout={(e: any) => { const bh = Math.round(e.nativeEvent.layout.height); if (bh !== barH) { setBarH(bh); const b = boxRef.current; if (b) { const h = b.h - b.pad - bh; if (!wv || Math.abs(wv.w - b.w) > 1 || Math.abs(wv.h - h) > 1) setWv({ w: b.w, h }); } } }}>"],
];
for (let i = 0; i < edits.length; i++) { const c = s.split(edits[i][0]).length - 1; if (c !== 1) { console.error(f + ' ANCHOR ' + (i + 1) + ' count = ' + c + ' - expected 1 (run wire_game_view_fix2.cjs first). Aborting - nothing written.'); process.exit(1); } }
for (const [a, b] of edits) s = s.split(a).join(b);
fs.writeFileSync(f, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log(f + ': patched - sideways games now fit exactly above the verified bar.');
