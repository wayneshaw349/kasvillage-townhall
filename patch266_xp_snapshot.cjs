// patch266_xp_snapshot.cjs — widen snapshot codec: cash|pos|owners|xp (KV_XP per seat)
// KV_ADOPT applies xp when present; older 3-part snaps tolerated.
// SRC showcase_kascity265.html -> DST showcase_kascity266.html
const fs = require("fs");
const SRC = "showcase_kascity265.html";
const DST = "showcase_kascity266.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");
const fails = [];
function must(a, n, label){ const c = s.split(a).length - 1; if (c !== n) fails.push(label + ": expected " + n + " found " + c); }

const A1 = '    return cash.join(",") + "|" + pos.join(",") + "|" + own.join(",");';
const A2 = '        Object.keys(incoming).forEach(function(k){ w.owners[k]=incoming[k]; });\n      }';

must(A1, 1, "A1 snapshot return");
must(A2, 1, "A2 adopt owners block");

if (fails.length) {
  console.error("ABORT — anchors:\n" + fails.join("\n"));
  process.exit(1);
}

s = s.replace(A1,
'    var xp=[]; for(var q=1;q<=4;q++){ xp.push(Math.round((window.KV_XP&&window.KV_XP[q])||0)); }   // __KV_V266\n' +
'    return cash.join(",") + "|" + pos.join(",") + "|" + own.join(",") + "|" + xp.join(",");');

s = s.replace(A2, A2 + '\n' +
'      // __KV_V266: xp travels with the snapshot\n' +
'      if(parts[3]!=null && window.KV_XP){\n' +
'        var xpA=(parts[3]||"").split(",").map(Number);\n' +
'        for(var q2=1;q2<=4;q2++){ if(isFinite(xpA[q2-1])) window.KV_XP[q2]=xpA[q2-1]; }\n' +
'      }');

fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
