// wire_game_landscape.cjs - rotate-to-landscape for chain games.
//
// expo-screen-orientation is NOT in package.json, so a native orientation lock
// would need a dev-client rebuild. This does it inside the WebView instead:
// the body is laid out at swapped dimensions and rotated into the viewport, so
// the game reflows as though the phone turned. Touch input keeps working
// because a CSS transform remaps coordinates for free.
//
// Button appears only for games (props.game), never for pages or stores.
// Run from layer1 root:  node src\\wire_game_landscape.cjs
const fs = require("fs");
const P = "OnChainPageView.tsx";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (s.includes("KV_ROT_JS")) { console.log("already patched"); process.exit(0); }
function rep(name, a, b) {
  const f = s.split(a).length - 1;
  if (f !== 1) { console.error("ABORT [" + name + "]: found " + f + ", expected 1"); process.exit(1); }
  s = s.split(a).join(b); console.log("ok  [" + name + "]");
}
rep("rot-js", "function injectCsp(raw: string): string {", "// Landscape without a native dependency. The body is laid out at swapped\n// dimensions and rotated into the portrait viewport, so the game reflows as if\n// the phone turned - no expo-screen-orientation, no dev-client rebuild. Touch\n// coordinates map through a real CSS transform, so input keeps working.\nconst KV_ROT_JS = \"(function(){var r=__R__;var b=document.body;if(!b)return;b.style.transformOrigin='0 0';b.style.margin='0';var vw=window.innerWidth,vh=window.innerHeight;if(!r){b.style.transform='none';b.style.width='';b.style.height='';}else{b.style.width=vh+'px';b.style.height=vw+'px';b.style.transform='translateX('+vw+'px) rotate(90deg)';}try{window.dispatchEvent(new Event('resize'));}catch(e){}try{window.__kvRot=r;}catch(e){}})();true;\";\n\nfunction injectCsp(raw: string): string {");
rep("rot-state", "  const [paySheet, setPaySheet] = useState<any>(null);", "  const [paySheet, setPaySheet] = useState<any>(null);\n  const [rot, setRot] = useState(false);");
rep("rot-button", "      <View style={styles.verifiedBar}>", "      {props.game ? (\n        <TouchableOpacity\n          onPress={() => {\n            const next = !rot;\n            setRot(next);\n            webRef.current?.injectJavaScript(KV_ROT_JS.replace('__R__', next ? '1' : '0'));\n          }}\n          style={{ position: 'absolute', right: 10, bottom: 46, width: 42, height: 42, borderRadius: 21,\n            backgroundColor: rot ? '#7c3aed' : 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: '#7c5cff',\n            alignItems: 'center', justifyContent: 'center' }}>\n          <Text style={{ color: '#fff', fontSize: 17 }}>{'\\u27F3'}</Text>\n        </TouchableOpacity>\n      ) : null}\n      <View style={styles.verifiedBar}>");
fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("\npatched " + P + " (3 edits). Landscape toggle live on game views.");
