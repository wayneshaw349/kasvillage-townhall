// patch265_opener_acked.cjs — bot stalled-opener derives the expected seat from chain-acked records only
// (unacked local bot rolls no longer convince the host that bot is next)
// SRC showcase_kascity264.html -> DST showcase_kascity265.html
const fs = require("fs");
const SRC = "showcase_kascity264.html";
const DST = "showcase_kascity265.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

const A = '            var mvB=(window.KV_MOVES||[]), lm=null;\n' +
'            for(var bqi=mvB.length-1;bqi>=0;bqi--){ if(mvB[bqi]){ lm=mvB[bqi]; break; } }';

const c = s.split(A).length - 1;
if (c !== 1) {
  console.error("ABORT — anchor found " + c + " times (expected 1)");
  process.exit(1);
}

const B = '            var mvB=(window.KV_MOVES||[]), lm=null;\n' +
'            for(var bqi=mvB.length-1;bqi>=0;bqi--){ if(mvB[bqi] && mvB[bqi].__acked){ lm=mvB[bqi]; break; } }   // __KV_V265: chain-acked only';

s = s.replace(A, B);
fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
