// wire_game_view_fix2.cjs - game player fixes (wallet):
//  1 only real kv:// links count as links -> no more "Unsupported link: sdk / ready" toast
//  2 games start below the phone's status bar / notch (left-side game buttons were cut off in landscape)
const fs = require('fs');
const f = 'OnChainPageView.tsx';
let s = fs.readFileSync(f, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
if (s.includes('KV_VIEW_FIX2')) { console.log(f + ': already patched - skipping'); process.exit(0); }
const edits = [];
if (!s.includes('KV_MSG_FIX')) edits.push(["      if (msg.kv && msg.kv !== 'ready') handleKvLink(msg.kv);", "      if (msg.kv && /^kv:\\/\\//.test(String(msg.kv))) handleKvLink(msg.kv); // KV_MSG_FIX: status signals are not links"]);
edits.push(
  ["  const [wv, setWv] = useState<{ w: number; h: number } | null>(null);\n",
   "  const [wv, setWv] = useState<{ w: number; h: number } | null>(null);\n  const [topPad, setTopPad] = useState<number | null>(null); // KV_VIEW_FIX2: keep games below the status bar\n  const outerRef = useRef<any>(null);\n"],
  ["    <View style={styles.fill} onLayout={(e: any) => { const L = e.nativeEvent.layout; if (!wv || Math.abs(wv.w - L.width) > 1 || Math.abs(wv.h - L.height) > 1) setWv({ w: L.width, h: L.height }); }}>\n      {props.game && (land === null || !wv) ? null : (",
   "    <View ref={outerRef} style={[styles.fill, { paddingTop: topPad || 0 }]} onLayout={(e: any) => { const L = e.nativeEvent.layout;\n      const done = (pad: number) => { const h = L.height - pad; setTopPad(pad); if (!wv || Math.abs(wv.w - L.width) > 1 || Math.abs(wv.h - h) > 1) setWv({ w: L.width, h }); };\n      let ins = 0; try { const m = require('react-native-safe-area-context').initialWindowMetrics; ins = (m && m.insets && m.insets.top) || 0; } catch {}\n      if (!props.game || !ins || topPad !== null) { done(topPad || 0); return; }\n      try { outerRef.current.measureInWindow((_x: number, y: number) => done(Math.max(0, Math.round(ins - (y || 0))))); } catch { done(0); } }}>\n      {props.game && (land === null || !wv || topPad === null) ? null : ("],
);
for (let i = 0; i < edits.length; i++) { const c = s.split(edits[i][0]).length - 1; if (c !== 1) { console.error(f + ' ANCHOR ' + (i + 1) + ' count = ' + c + ' - expected 1 (needs wire_game_landscape_v2 + wire_game_land_fix). Aborting - nothing written.'); process.exit(1); } }
for (const [a, b] of edits) s = s.split(a).join(b);
fs.writeFileSync(f, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log(f + ': patched - no "Unsupported link" toast; games sit below the status bar.');
