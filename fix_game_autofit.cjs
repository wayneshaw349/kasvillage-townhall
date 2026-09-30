// fix_game_autofit.cjs - fit the game as authored, don't re-lay it out.
//
// The landscape screenshot showed why the previous approach failed: forcing a
// portrait-only layout into a landscape body just squashes it into a band with
// dead space above and below. A fixed layout cannot be made responsive from
// outside the page.
//
// So: leave the game's own layout completely alone and scale the whole thing.
// __kvNat() measures the natural content box (widest child, lowest bottom edge
// - scrollHeight alone lies when the page is styled to 100%%), then AUTO picks
// the scale that fits it entirely and centres it.
//
// Adds a square AUTO button. Tapping rotate now re-fits automatically too.
// Requires fix_game_view_controls.cjs.
// Run from layer1 root:  node src\\fix_game_autofit.cjs
const fs = require("fs");
const P = "OnChainPageView.tsx";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (!s.includes("__kvView")) { console.error("ABORT: run fix_game_view_controls.cjs first"); process.exit(1); }
if (s.includes("__kvNat")) { console.log("already patched"); process.exit(0); }
function rep(name, a, b) {
  const f = s.split(a).length - 1;
  if (f !== 1) { console.error("ABORT [" + name + "]: found " + f + ", expected 1"); process.exit(1); }
  s = s.split(a).join(b); console.log("ok  [" + name + "]");
}
rep("autofit-js", "const KV_ROT_JS = \"(function(){try{var r=__R__,s=__S__;var b=document.body;if(!b)return;if(!window.__kvVInit){window.__kvVInit=1;var st=document.createElement('style');st.textContent='html,body{margin:0;padding:0;overflow:hidden;background:#000;}';document.head.appendChild(st);window.addEventListener('resize',function(){try{window.__kvView(window.__kvR||0,window.__kvS||1);}catch(e){}});}window.__kvView=function(rr,ss){var vw=window.innerWidth,vh=window.innerHeight;b.style.transformOrigin='0 0';b.style.transform='none';var lw=(rr?vh:vw)/ss,lh=(rr?vw:vh)/ss;b.style.width=lw+'px';b.style.height=lh+'px';b.style.transform=(rr?('translate('+vw+'px,0px) rotate(90deg) '):'')+'scale('+ss+')';window.__kvR=rr;window.__kvS=ss;try{window.dispatchEvent(new Event('resize'));}catch(e){}};window.__kvView(r,s);}catch(e){}})();true;\";", "const KV_ROT_JS = \"(function(){try{var r=__R__,s=__S__;var b=document.body;if(!b)return;if(!window.__kvVInit){window.__kvVInit=1;var st=document.createElement('style');st.textContent='html{background:#000;}html,body{margin:0;padding:0;overflow:hidden;}';document.head.appendChild(st);window.addEventListener('resize',function(){try{window.__kvView(window.__kvR||0,window.__kvS||0);}catch(e){}});}window.__kvNat=function(){var t=b.style.transform;b.style.transform='none';var w=1,h=1,i,c=b.children;for(i=0;i<c.length;i++){var q=c[i].getBoundingClientRect();if(q.width>w)w=q.width;if(q.bottom>h)h=q.bottom;}w=Math.max(w,b.scrollWidth,1);h=Math.max(h,b.scrollHeight,1);b.style.transform=t;return{w:w,h:h};};window.__kvView=function(rr,ss){b.style.transformOrigin='0 0';var vw=window.innerWidth,vh=window.innerHeight;var n=window.__kvNat();if(!ss){var tw=rr?vh:vw,th=rr?vw:vh;ss=Math.min(tw/n.w,th/n.h);if(!isFinite(ss)||ss<=0)ss=1;ss=Math.round(ss*100)/100;}var x,y;if(rr){x=(vw+ss*n.h)/2;y=(vh-ss*n.w)/2;b.style.transform='translate('+x+'px,'+y+'px) rotate(90deg) scale('+ss+')';}else{x=(vw-ss*n.w)/2;if(x<0)x=0;y=(vh-ss*n.h)/2;if(y<0)y=0;b.style.transform='translate('+x+'px,'+y+'px) scale('+ss+')';}window.__kvR=rr;window.__kvS=ss;try{window.ReactNativeWebView.postMessage(JSON.stringify({kvview:1,scale:ss,w:n.w,h:n.h}));}catch(e){}};window.__kvView(r,s);}catch(e){}})();true;\";");
rep("auto-button", "            { t: '\\u27F3', on: () => { const n = !rot; setRot(n); applyView(n, zoom); }, hot: rot },", "            { t: '\\u27F3', on: () => { const n = !rot; setRot(n); applyView(n, 0); }, hot: rot },\n            { t: '\\u25A3', on: () => { setZoom(0); applyView(rot, 0); }, hot: false },");
fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("\npatched " + P + " (2 edits). AUTO fits the whole board; rotate re-fits.");
