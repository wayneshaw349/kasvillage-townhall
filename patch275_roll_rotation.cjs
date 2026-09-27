// patch275_roll_rotation.cjs — "who rolls next" derives from the last acked ROLL, not any move.
// Tracks M.__lastRollRx (seat, index, receipt time) from both the poller and our own ack path.
// The stalled-bot opener uses: roller still deciding (<10s, no follow) -> roller; else (s%4)+1.
// SRC showcase_kascity274.html -> DST showcase_kascity275.html
const fs = require("fs");
const SRC = "showcase_kascity274.html";
const DST = "showcase_kascity275.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");
const fails = [];
function must(a, n, label){ const c = s.split(a).length - 1; if (c !== n) fails.push(label + ": expected " + n + " found " + c); }

const A1 = 'if(m.a==="opener"){ M.opener=m.s; return; }   // __KV_V243: informational; seeds the gate server-side';
const A2 = '            M.seen[o.i]=1;                 // our own entry: the /log echo is not re-applied';
const A3 = '            var mvB=(window.KV_MOVES||[]), lm=null;\n' +
'            for(var bqi=mvB.length-1;bqi>=0;bqi--){ if(mvB[bqi] && mvB[bqi].__acked){ lm=mvB[bqi]; break; } }   // __KV_V265: chain-acked only\n' +
'            var expB = lm ? ((String(lm.a)==="roll")?lm.s:((lm.s%4)+1)) : null;';

must(A1, 1, "A1 poller opener line");
must(A2, 1, "A2 ack line");
must(A3, 1, "A3 kicker derivation");

if (fails.length) {
  console.error("ABORT — anchors:\n" + fails.join("\n"));
  process.exit(1);
}

// A1: poller tracks last roll receipt
s = s.replace(A1, A1 + '\n' +
'          if(m.a==="roll"){ M.__lastRollRx={ s:m.s, i:m.i, at:Date.now() }; }   // __KV_V275');

// A2: our own acked roll counts too
s = s.replace(A2, A2 + '\n' +
'            if(String(r.a)==="roll"){ M.__lastRollRx={ s:r.s, i:o.i, at:Date.now() }; }   // __KV_V275');

// A3: roll-based rotation with decision-window grace
s = s.replace(A3,
'            var mvB=(window.KV_MOVES||[]);\n' +
'            // __KV_V275: rotation is driven by rolls; a mgmt/bid entry never changes whose turn it is\n' +
'            var lrX=M.__lastRollRx||null, expB=null;\n' +
'            if(lrX){\n' +
'              var closedX=false;\n' +
'              for(var bq2=mvB.length-1;bq2>=0;bq2--){\n' +
'                var rr2=mvB[bq2]; if(!rr2||!rr2.__acked) continue;\n' +
'                if(rr2.i<=lrX.i) break;\n' +
'                if(rr2.s===lrX.s && /^(buy|pass|end)$/.test(String(rr2.a))){ closedX=true; break; }\n' +
'              }\n' +
'              expB = (closedX || Date.now()-lrX.at>10000) ? ((lrX.s%4)+1) : lrX.s;\n' +
'            }');

fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
