// wire_tip_optin.cjs - ACCEPT TIPS becomes a real toggle, off by default.
//
// Before: tip_addr was stamped into every quad unconditionally - not opt-in.
// After: a checkbox in the game publish panel. tip_addr enters the quad only
// while it is ON, and the mailbox card only renders a TIP button when a quad
// declares one. Off by default; persists per device (kv_tip_optin).
// Requires fix_quad_tip.cjs applied first. Takes effect on the NEXT announce.
// Run from layer1 root:  node src\\wire_tip_optin.cjs
const fs = require("fs");
const P = "Workspace.tsx";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (!s.includes("tip_addr")) { console.error("ABORT: run fix_quad_tip.cjs first"); process.exit(1); }
if (s.includes("kv_tip_optin")) { console.log("already patched"); process.exit(0); }
function rep(name, a, b, n) {
  n = n || 1;
  const f = s.split(a).length - 1;
  if (f !== n) { console.error("ABORT [" + name + "]: found " + f + ", expected " + n); process.exit(1); }
  s = s.split(a).join(b); console.log("ok  [" + name + "] x" + n);
}
rep("optin-state", "  const [gbusy, setGbusy] = useState('');", "  const [gbusy, setGbusy] = useState('');\n  // Tips are OPT-IN. tip_addr enters the announced quad only while this is on,\n  // and cards render a TIP button only when a quad declares one. Off by\n  // default; the choice persists per device.\n  const [tipOn, setTipOn] = useState(false);\n  useEffect(() => { (async () => {\n    try {\n      const AS = require('@react-native-async-storage/async-storage').default;\n      setTipOn((await AS.getItem('kv_tip_optin')) === '1');\n    } catch {}\n  })(); }, []);\n  const toggleTip = async (v: boolean) => {\n    setTipOn(v);\n    try {\n      const AS = require('@react-native-async-storage/async-storage').default;\n      await AS.setItem('kv_tip_optin', v ? '1' : '0');\n    } catch {}\n  };");
rep("gate-quads", "tip_addr: myAddr,", "...(tipOn ? { tip_addr: myAddr } : {}),", 3);
rep("optin-checkbox", "      {Object.entries(GAMES).map(([id, e]: any) => (", "      <TouchableOpacity onPress={() => toggleTip(!tipOn)} activeOpacity={0.8}\n        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: tipOn ? '#241f36' : '#17171f',\n          borderWidth: 1, borderColor: tipOn ? '#7c5cff' : '#333', borderRadius: 8, padding: 10, marginBottom: 8 }}>\n        <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 2, marginRight: 10,\n          borderColor: tipOn ? '#7c5cff' : '#555', backgroundColor: tipOn ? '#7c5cff' : 'transparent',\n          alignItems: 'center', justifyContent: 'center' }}>\n          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>{tipOn ? '\\u2713' : ''}</Text>\n        </View>\n        <View style={{ flex: 1 }}>\n          <Text style={{ color: tipOn ? '#b9a6ff' : '#888', fontFamily: 'monospace', fontWeight: '800', fontSize: 12 }}>\n            {'\\U0001F49C ACCEPT TIPS' + (tipOn ? '' : '  (off)')}\n          </Text>\n          <Text style={{ color: '#6f6f85', fontSize: 9, marginTop: 3, lineHeight: 12 }}>\n            {tipOn\n              ? 'Your address goes into the announced quad. Players see a TIP button; KAS goes wallet-to-wallet, never through KasVillage.'\n              : 'No tip address is published and no TIP button is shown. Turn on BEFORE announcing to take effect.'}\n          </Text>\n        </View>\n      </TouchableOpacity>\n      {Object.entries(GAMES).map(([id, e]: any) => (");
fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("\npatched " + P + " (5 edits). ACCEPT TIPS toggle live, default OFF.");
