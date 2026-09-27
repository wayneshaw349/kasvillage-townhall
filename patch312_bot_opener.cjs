// patch312_bot_opener.cjs — 310's bot poster derived the opener from "first" entries in KV_MOVES,
// but the poller returns early on those and stores them in M.firstList instead, so the poster never
// saw an opener and bots never took the first turn.
// Read M.opener first, then M.firstList, and only then fall back to KV_MOVES.
// SRC showcase_kascity311.html -> DST showcase_kascity312.html
const fs = require("fs");
const SRC = "showcase_kascity311.html";
const DST = "showcase_kascity312.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

const A = '    if (!lastRoll){\n' +
'      var op = opener || deriveOpener(firsts);\n' +
'      return op ? { seat: op, stage: "roll" } : null;\n' +
'    }';

const c = s.split(A).length - 1;
if (c !== 1) {
  console.error("ABORT — anchor found " + c + " times (expected 1). Is 310 applied?");
  process.exit(1);
}

s = s.replace(A,
'    if (!lastRoll){\n' +
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
'    }');

fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
