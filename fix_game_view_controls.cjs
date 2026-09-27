// fix_game_view_controls.cjs - rotate + zoom you can actually drive.
//
// Auto-fit did nothing because the board reports full viewport height, so the
// computed scale was always 1. Measurement can't be trusted on a game that
// lays itself out to 100%% - so hand the controls to the player instead.
//
// The important part is HOW the scale is applied. Rather than shrinking a
// fixed canvas, the body is laid out at (viewport / scale) css pixels and then
// scaled down. At 50%% the game gets TWICE the css pixels to lay out in, so it
// genuinely reflows smaller and off-screen controls (the ROLL button) come
// back into reach - instead of just being a smaller picture of the same
// cropped screen.
//
// Landscape geometry: transform-origin is 0 0, so scale(s) then rotate(90deg)
// puts content at x in [-vw, 0] - translate(vw, 0) brings it back on screen.
//
// Controls: rotate, minus, plus, with a live percentage. Games only.
// Requires wire_game_landscape.cjs + fix_game_fit.cjs.
// Run from layer1 root:  node src\\fix_game_view_controls.cjs
const fs = require("fs");
const P = "OnChainPageView.tsx";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (!s.includes("KV_ROT_JS")) { console.error("ABORT: run wire_game_landscape.cjs first"); process.exit(1); }
if (s.includes("__kvView")) { console.log("already patched"); process.exit(0); }
function rep(name, a, b) {
  const f = s.split(a).length - 1;
  if (f !== 1) { console.error("ABORT [" + name + "]: found " + f + ", expected 1"); process.exit(1); }
  s = s.split(a).join(b); console.log("ok  [" + name + "]");
}
rep("view-js", "const KV_ROT_JS = \"(function(){try{var r=__R__;var b=document.body;if(!b)return;var d=document.documentElement;if(!window.__kvFitInit){window.__kvFitInit=1;var st=document.createElement('style');st.textContent='html,body{margin:0;padding:0;overflow:hidden;}';document.head.appendChild(st);window.addEventListener('resize',function(){try{window.__kvFit(window.__kvRot||0);}catch(e){}});}window.__kvFit=function(rr){b.style.transformOrigin='0 0';b.style.transform='none';b.style.width='';b.style.height='';var cw=Math.max(b.scrollWidth,b.offsetWidth,1);var ch=Math.max(b.scrollHeight,b.offsetHeight,1);var vw=window.innerWidth,vh=window.innerHeight;var tw=rr?vh:vw,th=rr?vw:vh;var k=Math.min(tw/cw,th/ch);if(!isFinite(k)||k<=0)k=1;if(k>4)k=4;var x,y;if(rr){x=(vw+k*ch)/2;y=(vh-k*cw)/2;b.style.transform='translate('+x+'px,'+y+'px) rotate(90deg) scale('+k+')';}else{x=(vw-k*cw)/2;y=(vh-k*ch)/2;b.style.transform='translate('+x+'px,'+y+'px) scale('+k+')';}window.__kvRot=rr;try{window.dispatchEvent(new Event('resize'));}catch(e){}};window.__kvFit(r);}catch(e){}})();true;\";", "const KV_ROT_JS = \"(function(){try{var r=__R__,s=__S__;var b=document.body;if(!b)return;if(!window.__kvVInit){window.__kvVInit=1;var st=document.createElement('style');st.textContent='html,body{margin:0;padding:0;overflow:hidden;background:#000;}';document.head.appendChild(st);window.addEventListener('resize',function(){try{window.__kvView(window.__kvR||0,window.__kvS||1);}catch(e){}});}window.__kvView=function(rr,ss){var vw=window.innerWidth,vh=window.innerHeight;b.style.transformOrigin='0 0';b.style.transform='none';var lw=(rr?vh:vw)/ss,lh=(rr?vw:vh)/ss;b.style.width=lw+'px';b.style.height=lh+'px';b.style.transform=(rr?('translate('+vw+'px,0px) rotate(90deg) '):'')+'scale('+ss+')';window.__kvR=rr;window.__kvS=ss;try{window.dispatchEvent(new Event('resize'));}catch(e){}};window.__kvView(r,s);}catch(e){}})();true;\";");
rep("view-state", "  const [rot, setRot] = useState(false);", "  const [rot, setRot] = useState(false);\n  const [zoom, setZoom] = useState(1);\n  const applyView = (r: boolean, z: number) => {\n    webRef.current?.injectJavaScript(KV_ROT_JS.replace('__R__', r ? '1' : '0').replace('__S__', String(z)));\n  };");
rep("view-controls", "      {props.game ? (\n        <TouchableOpacity\n          onPress={() => {\n            const next = !rot;\n            setRot(next);\n            webRef.current?.injectJavaScript(KV_ROT_JS.replace('__R__', next ? '1' : '0'));\n          }}\n          style={{ position: 'absolute', right: 10, bottom: 46, width: 42, height: 42, borderRadius: 21,\n            backgroundColor: rot ? '#7c3aed' : 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: '#7c5cff',\n            alignItems: 'center', justifyContent: 'center' }}>\n          <Text style={{ color: '#fff', fontSize: 17 }}>{'\\u27F3'}</Text>\n        </TouchableOpacity>\n      ) : null}", "      {props.game ? (\n        <View style={{ position: 'absolute', right: 6, top: '32%' }}>\n          {[\n            { t: '\\u27F3', on: () => { const n = !rot; setRot(n); applyView(n, zoom); }, hot: rot },\n            { t: '\\u2212', on: () => { const z = Math.max(0.3, Math.round((zoom - 0.15) * 100) / 100); setZoom(z); applyView(rot, z); }, hot: false },\n            { t: '+', on: () => { const z = Math.min(1.5, Math.round((zoom + 0.15) * 100) / 100); setZoom(z); applyView(rot, z); }, hot: false },\n          ].map((b, i) => (\n            <TouchableOpacity key={i} onPress={b.on}\n              style={{ width: 36, height: 36, borderRadius: 18, marginBottom: 7,\n                backgroundColor: b.hot ? '#7c3aed' : 'rgba(10,10,16,0.82)',\n                borderWidth: 1, borderColor: '#7c5cff', alignItems: 'center', justifyContent: 'center' }}>\n              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{b.t}</Text>\n            </TouchableOpacity>\n          ))}\n          <Text style={{ color: '#b9a6ff', fontSize: 9, textAlign: 'center' }}>{Math.round(zoom * 100) + '%'}</Text>\n        </View>\n      ) : null}");
fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("\npatched " + P + " (3 edits). Rotate + zoom controls live on the right edge.");
