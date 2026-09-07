// patch257_pindice_v3.cjs — pinned dice, corrected descriptor anchors (setFlagExpr)
// SRC showcase_kascity256.html -> DST showcase_kascity257.html
const fs = require("fs");
const SRC = "showcase_kascity256.html";
const DST = "showcase_kascity257.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");
const fails = [];
function must(anchor, n, label) {
  const c = s.split(anchor).length - 1;
  if (c !== n) fails.push(label + ": expected " + n + " found " + c);
}

const A1 = "rand: function () { return rnd(); },";
const A2 = '\\"setFlagExpr\\",\\"args\\":[\\"d1\\",\\"floor(rand() * 6) + 1\\"]';
const A3 = '\\"setFlagExpr\\",\\"args\\":[\\"d2\\",\\"floor(rand() * 6) + 1\\"]';
const A4 = '      var fits = (a==="roll") ? /Tap to roll/.test(txt) : /buy|pass|deed|block/i.test(txt);';
const A5 = "      M.queue = [];";

must(A1, 1, "A1 rand helper");
must(A2, 1, "A2 d1 setFlagExpr");
must(A3, 1, "A3 d2 setFlagExpr");
must(A4, 1, "A4 drain fits");
must(A5, 1, "A5 resync queue");

if (fails.length) {
  console.error("ABORT — anchors:\n" + fails.join("\n"));
  process.exit(1);
}

s = s.replace(A1, A1 + "\n" +
"  pinroll: function (which) {\n" +
"    var P = window.__KV_PIN;\n" +
"    if (P) {\n" +
"      var ks = Object.keys(P).filter(function(k){ return k !== '__a'; });\n" +
"      if (ks.length) {\n" +
"        var k = ks[0], v = +P[k];\n" +
"        if (which === 1) { var a = Math.min(6, Math.max(1, Math.ceil(v/2))); P.__a = a; return a; }\n" +
"        var a2 = (P.__a != null) ? P.__a : Math.min(6, Math.max(1, Math.ceil(v/2)));\n" +
"        var b = Math.min(6, Math.max(1, v - a2));\n" +
"        delete P[k]; delete P.__a;\n" +
"        return b;\n" +
"      }\n" +
"    }\n" +
"    return 1 + Math.floor(rnd()*6);\n" +
"  },");

s = s.replace(A2, '\\"setFlagExpr\\",\\"args\\":[\\"d1\\",\\"pinroll(1)\\"]');
s = s.replace(A3, '\\"setFlagExpr\\",\\"args\\":[\\"d2\\",\\"pinroll(2)\\"]');

s = s.replace(A4, A4 + "\n" +
'      if(a==="roll" && !(m.s===M.seat || M.owns(m.s))){ window.__KV_PIN=(window.__KV_PIN||{}); window.__KV_PIN[m.s]=+m.v; }');

s = s.replace(A5, A5 + "\n      window.__KV_PIN = null;");

fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
