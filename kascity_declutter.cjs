// kascity_declutter.cjs - KasCity on a phone, less cluttered:
//   - player cards shrink to 62% (tap a card to see it full size, tap again to shrink)
//   - HOLDINGS / PLAY BY PLAY / WHAT HAD HAPPENED WAS / LOG / COPY LOG move behind one "MORE" button
//   - MUSIC, OFFERS, START and the big ROLL stay where they are
// Usage: node kascity_declutter.cjs <input.html> <output.html>   (run after kascity_visibility.cjs)
const fs = require('fs');
const [, , IN, OUT] = process.argv;
if (!IN || !OUT) { console.error('usage: node kascity_declutter.cjs <input.html> <output.html>'); process.exit(1); }
const DC = "<script>\n// ---- __KV_DECLUTTER: phone layout - small player cards (tap to expand), one MORE menu for the extras ----\n(function(){\n  var css=document.createElement(\"style\");\n  css.textContent=\n    \"[data-kvseat]{transition:transform .15s}\"+\n    \"[data-kvseat='1']{transform-origin:0 0}[data-kvseat='2']{transform-origin:100% 0}[data-kvseat='3']{transform-origin:0 100%}[data-kvseat='4']{transform-origin:100% 100%}\"+\n    \"[data-kvseat]:not(.kvbig){transform:scale(.62) !important;opacity:.9}\"+\n    \"#kvbar:not(.kvmore) #kvbar_holdb,#kvbar:not(.kvmore) #kvbar_pbpb,#kvbar:not(.kvmore) #kvbar_whwb,#kvbar:not(.kvmore) #kvbar_logb,#kvbar:not(.kvmore) #kvbar_copyb{display:none !important}\"+\n    \"#kvbar_moreb{font-weight:700}\";\n  document.head.appendChild(css);\n  // tap a player card to see it full size; tap again to shrink\n  document.addEventListener(\"click\",function(e){ var t=e.target, c=t&&t.closest?t.closest(\"[data-kvseat]\"):null; if(c) c.classList.toggle(\"kvbig\"); },true);\n  function addMore(){\n    var bar=document.getElementById(\"kvbar\"); if(!bar){ setTimeout(addMore,500); return; }\n    if(document.getElementById(\"kvbar_moreb\")) return;\n    var b=document.createElement(\"button\"); b.className=\"kvtb\"; b.id=\"kvbar_moreb\"; b.textContent=\"☰ MORE\";\n    b.onclick=function(){ var on=!bar.classList.contains(\"kvmore\"); bar.classList.toggle(\"kvmore\",on); b.className=\"kvtb\"+(on?\" on\":\"\"); };\n    var stat=document.getElementById(\"kvbar_stat\"); if(stat) bar.insertBefore(b,stat); else bar.appendChild(b);\n  }\n  addMore();\n})();\n</script>\n";
let s = fs.readFileSync(IN, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
if (s.includes('__KV_DECLUTTER')) { console.log(IN + ': already decluttered - nothing to do'); process.exit(0); }
s = s.replace(/\s*$/, '\n') + DC;
fs.writeFileSync(OUT, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log('OK - ' + OUT + ' written (' + fs.statSync(OUT).size + ' bytes)');
