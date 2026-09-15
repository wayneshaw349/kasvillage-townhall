// patch314_panel_yield.cjs — the 311 panel posted "pass" on turns the engine had already decided
// (its closer was still unacked, so the turn looked open). Any local buy/pass/end by our seat after
// the roll now counts as closed, acked or not — the panel only appears when no decision exists.
// SRC showcase_kascity313.html -> DST showcase_kascity314.html
const fs = require("fs");
const SRC = "showcase_kascity313.html";
const DST = "showcase_kascity314.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

const A = '    if (!lastRoll || lastRoll.s !== m.seat) return null;\n' +
'    for (var j = 0; j < mv.length; j++){\n' +
'      var q = mv[j]; if (!q || !q.__acked) continue;\n' +
'      if (q.i <= lastRoll.i) continue;\n' +
'      if (q.s === lastRoll.s && /^(buy|pass|end)$/.test(String(q.a))) return null;   // already closed\n' +
'    }\n' +
'    return lastRoll;';

const c = s.split(A).length - 1;
if (c !== 1) {
  console.error("ABORT — anchor found " + c + " times (expected 1). Is 311 applied?");
  process.exit(1);
}

s = s.replace(A,
'    if (!lastRoll || lastRoll.s !== m.seat) return null;\n' +
'    // __KV_V314: ANY local closer counts, acked or not — the engine may have decided already\n' +
'    for (var j = 0; j < mv.length; j++){\n' +
'      var q = mv[j]; if (!q) continue;\n' +
'      if (q.i <= lastRoll.i) continue;\n' +
'      if (q.s === lastRoll.s && /^(buy|pass|end)$/.test(String(q.a))) return null;\n' +
'    }\n' +
'    return lastRoll;');

fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
