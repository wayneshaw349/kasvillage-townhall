// fix_game_fit.cjs - scale the game to the phone, not just rotate it.
//
// Rotating alone leaves a 414px-wide board sitting in the corner. This
// measures the content with the transform cleared, computes the largest scale
// that fits the viewport (rotated or not), and centres it.
//
// The translate maths matters: transform-origin is 0 0, so after
// scale(k) rotate(90deg) the content occupies k*ch wide by k*cw tall. Using
// the raw viewport width pushes the board off-screen whenever the other axis
// is the binding constraint - which is most of the time.
//
// Re-fits on resize, and on rotate. Requires wire_game_landscape.cjs.
// Run from layer1 root:  node src\\fix_game_fit.cjs
const fs = require("fs");
const P = "OnChainPageView.tsx";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (!s.includes("KV_ROT_JS")) { console.error("ABORT: run wire_game_landscape.cjs first"); process.exit(1); }
if (s.includes("__kvFit")) { console.log("already patched"); process.exit(0); }
function rep(name, a, b) {
  const f = s.split(a).length - 1;
  if (f !== 1) { console.error("ABORT [" + name + "]: found " + f + ", expected 1"); process.exit(1); }
  s = s.split(a).join(b); console.log("ok  [" + name + "]");
}
rep("fit-js", "const KV_ROT_JS = \"(function(){var r=__R__;var b=document.body;if(!b)return;b.style.transformOrigin='0 0';b.style.margin='0';var vw=window.innerWidth,vh=window.innerHeight;if(!r){b.style.transform='none';b.style.width='';b.style.height='';}else{b.style.width=vh+'px';b.style.height=vw+'px';b.style.transform='translateX('+vw+'px) rotate(90deg)';}try{window.dispatchEvent(new Event('resize'));}catch(e){}try{window.__kvRot=r;}catch(e){}})();true;\";", "const KV_ROT_JS = \"(function(){try{var r=__R__;var b=document.body;if(!b)return;var d=document.documentElement;if(!window.__kvFitInit){window.__kvFitInit=1;var st=document.createElement('style');st.textContent='html,body{margin:0;padding:0;overflow:hidden;}';document.head.appendChild(st);window.addEventListener('resize',function(){try{window.__kvFit(window.__kvRot||0);}catch(e){}});}window.__kvFit=function(rr){b.style.transformOrigin='0 0';b.style.transform='none';b.style.width='';b.style.height='';var cw=Math.max(b.scrollWidth,b.offsetWidth,1);var ch=Math.max(b.scrollHeight,b.offsetHeight,1);var vw=window.innerWidth,vh=window.innerHeight;var tw=rr?vh:vw,th=rr?vw:vh;var k=Math.min(tw/cw,th/ch);if(!isFinite(k)||k<=0)k=1;if(k>4)k=4;var x,y;if(rr){x=(vw+k*ch)/2;y=(vh-k*cw)/2;b.style.transform='translate('+x+'px,'+y+'px) rotate(90deg) scale('+k+')';}else{x=(vw-k*cw)/2;y=(vh-k*ch)/2;b.style.transform='translate('+x+'px,'+y+'px) scale('+k+')';}window.__kvRot=rr;try{window.dispatchEvent(new Event('resize'));}catch(e){}};window.__kvFit(r);}catch(e){}})();true;\";");
fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("\npatched " + P + " (1 edit). Game now scales to fill the phone.");
