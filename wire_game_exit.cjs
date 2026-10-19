// wire_game_exit.cjs - a clear way out of a running game back to the wallet.
//  - red X at the top of the game's side buttons (same column as the rotate button)
//  - asks "Leave KasCity?" first (an online game keeps your seat - Rejoin table brings you back)
//  - Android back button does the same
const fs = require('fs');
const f = 'OnChainPageView.tsx';
let s = fs.readFileSync(f, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
if (s.includes('KV_GAME_EXIT')) { console.log(f + ': already patched - skipping'); process.exit(0); }
const A = "        <View style={{ position: 'absolute', right: 6, top: '32%' }}>\n";
const B = "        <View style={{ position: 'absolute', right: 6, top: '32%' }}>\n" +
"          {props.onClose ? ( /* KV_GAME_EXIT */\n" +
"            <TouchableOpacity onPress={() => kvAskExit()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}\n" +
"              style={{ width: 36, height: 36, borderRadius: 18, marginBottom: 10, backgroundColor: '#b91c1c', borderWidth: 2, borderColor: '#fecaca', alignItems: 'center', justifyContent: 'center' }}>\n" +
"              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900' }}>{'\\u2715'}</Text>\n" +
"            </TouchableOpacity>\n" +
"          ) : null}\n";
const C = "  const [wv, setWv] = useState<{ w: number; h: number } | null>(null);\n";
const D = C +
"  // KV_GAME_EXIT: leave the game and return to the wallet (confirm first)\n" +
"  const kvAskExit = () => { if (!props.onClose) return; const RN = require('react-native');\n" +
"    RN.Alert.alert('Leave the game?', 'You go back to your wallet. In an online game your seat is kept - open the game again and tap Rejoin table.', [\n" +
"      { text: 'Keep playing', style: 'cancel' }, { text: 'Leave', style: 'destructive', onPress: () => props.onClose && props.onClose() }]); };\n" +
"  useEffect(() => { if (!props.game || !props.onClose) return; const RN = require('react-native');\n" +
"    const sub = RN.BackHandler.addEventListener('hardwareBackPress', () => { kvAskExit(); return true; });\n" +
"    return () => { try { sub.remove(); } catch {} }; }, [props.game, props.onClose]);\n";
for (const [a, n] of [[A, 'side buttons'], [C, 'state']]) { const c = s.split(a).length - 1; if (c !== 1) { console.error(f + ' ' + n + ' anchor count = ' + c + ' - expected 1. Aborting - nothing written.'); process.exit(1); } }
s = s.replace(A, B).replace(C, D);
fs.writeFileSync(f, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log(f + ': patched - red X (and Android back) leaves the game after a confirm.');
