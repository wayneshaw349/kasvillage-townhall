// patch267_adopt_walk.cjs — KV_ADOPT animates position changes (<=12 tiles) instead of teleporting
// Movement trace is already suppressed 6s post-adopt, so the animation can't trip it.
// SRC showcase_kascity266.html -> DST showcase_kascity267.html
const fs = require("fs");
const SRC = "showcase_kascity266.html";
const DST = "showcase_kascity267.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");
const fails = [];
function must(a, n, label){ const c = s.split(a).length - 1; if (c !== n) fails.push(label + ": expected " + n + " found " + c); }

const A1 = '  // __KV_V212: symmetric writer';
const A2 = '        if(window.KV_SETSTATE && isFinite(pos[p-1]) && pos[p-1]>=0) window.KV_SETSTATE("p"+p, pos[p-1]);';

must(A1, 1, "A1 adopt banner");
must(A2, 1, "A2 adopt pos write");

if (fails.length) {
  console.error("ABORT — anchors:\n" + fails.join("\n"));
  process.exit(1);
}

s = s.replace(A1,
'  // __KV_V267: adopted positions walk, not teleport\n' +
'  window.__KV_WALK = window.__KV_WALK || {};\n' +
'  function __kvWalkTo(p, target){\n' +
'    try{\n' +
'      var f=(window.KV_FLAGS&&window.KV_FLAGS())||{}; var cur=f["p"+p];\n' +
'      if(window.__KV_WALK[p]){ clearInterval(window.__KV_WALK[p]); delete window.__KV_WALK[p]; }\n' +
'      if(cur==null || cur<0 || cur===target){ window.KV_SETSTATE("p"+p, target); return; }\n' +
'      var steps=((target-cur)%40+40)%40;\n' +
'      if(steps===0 || steps>12){ window.KV_SETSTATE("p"+p, target); return; }\n' +
'      var at=cur;\n' +
'      window.__KV_WALK[p]=setInterval(function(){\n' +
'        at=(at+1)%40; window.KV_SETSTATE("p"+p, at);\n' +
'        if(at===target){ clearInterval(window.__KV_WALK[p]); delete window.__KV_WALK[p]; }\n' +
'      }, 120);\n' +
'    }catch(e){ try{ window.KV_SETSTATE("p"+p, target); }catch(e2){} }\n' +
'  }\n' +
A1);

s = s.replace(A2, '        if(window.KV_SETSTATE && isFinite(pos[p-1]) && pos[p-1]>=0) __kvWalkTo(p, pos[p-1]);   // __KV_V267');

fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
