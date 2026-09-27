// patch313_opener_from_moves.cjs — the bot poster could not find an opener:
//   * M.opener is undefined on the host (it published an opener but never set it locally)
//   * M.firstList only holds firsts that arrived from the chain, so the host's own are missing
//   * KV_MOVES has all four, but with duplicates and some unacked
// Derive from KV_MOVES, taking the FIRST recorded value per seat, ignoring duplicates, and
// accepting unacked entries (a first is posted once and never contested).
// SRC showcase_kascity312.html -> DST showcase_kascity313.html
const fs = require("fs");
const SRC = "showcase_kascity312.html";
const DST = "showcase_kascity313.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

const A = '    if (!lastRoll){\n' +
'      // __KV_V312: the poller keeps "first" entries in M.firstList, not KV_MOVES\n' +
'      var mm = M();\n' +
'      var op = opener || (mm && mm.opener) || null;\n' +
'      if (!op && mm && mm.firstList){\n' +
'        var fl = [];\n' +
'        for (var sN = 1; sN <= 4; sN++){\n' +
'          var arr = mm.firstList[sN];\n' +
'          if (arr && arr.length) fl.push([sN, +arr[arr.length - 1] || 0]);\n' +
'        }\n' +
'        if (fl.length === 4) op = deriveOpener(fl);\n' +
'      }\n' +
'      if (!op) op = deriveOpener(firsts);\n' +
'      return op ? { seat: op, stage: "roll" } : null;\n' +
'    }';

const c = s.split(A).length - 1;
if (c !== 1) {
  console.error("ABORT — anchor found " + c + " times (expected 1). Is 312 applied?");
  process.exit(1);
}

s = s.replace(A,
'    if (!lastRoll){\n' +
'      // __KV_V313: all four firsts live in KV_MOVES; dedupe by seat, keep the first value seen\n' +
'      var seen = {}, fl = [];\n' +
'      var mvF = window.KV_MOVES || [];\n' +
'      for (var fi = 0; fi < mvF.length; fi++){\n' +
'        var fr = mvF[fi];\n' +
'        if (!fr || String(fr.a) !== "first") continue;\n' +
'        var fs2 = +fr.s;\n' +
'        if (fs2 < 1 || fs2 > 4 || seen[fs2]) continue;\n' +
'        seen[fs2] = 1;\n' +
'        fl.push([fs2, +fr.v || 0]);\n' +
'      }\n' +
'      var mm = M();\n' +
'      var op = null;\n' +
'      if (fl.length === 4) op = deriveOpener(fl);\n' +
'      if (!op) op = opener || (mm && mm.opener) || null;\n' +
'      return op ? { seat: op, stage: "roll" } : null;\n' +
'    }');

fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
