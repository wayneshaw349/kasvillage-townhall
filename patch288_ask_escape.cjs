// patch288_ask_escape.cjs — when the controller asks the same OWNED seat to roll repeatedly and no
// ask ever appears, that seat's turn is wedged mid-turn (its roll landed, no closer posted). After
// 3 asks (~15s) close it on the chain with an explicit pass so rotation resumes.
// SRC showcase_kascity287.html -> DST showcase_kascity288.html
const fs = require("fs");
const SRC = "showcase_kascity287.html";
const DST = "showcase_kascity288.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

const A = '          if(Date.now()-lastAsk<4000) return;\n' +
'          lastAsk=Date.now();\n' +
'          if(window.KV_SETSTATE){\n' +
'            window.KV_SETSTATE("rollshow",0); window.KV_SETSTATE("rollv",0); window.KV_SETSTATE("rollt",0);\n' +
'            window.KV_SETSTATE("asked",0); window.KV_SETSTATE("go",0);\n' +
'          }\n' +
'          log("turn: asking P"+exp+" to roll", "#caa64c");\n' +
'          return;';

const c = s.split(A).length - 1;
if (c !== 1) {
  console.error("ABORT — anchor found " + c + " times (expected 1)");
  process.exit(1);
}

s = s.replace(A,
'          if(Date.now()-lastAsk<4000) return;\n' +
'          lastAsk=Date.now();\n' +
'          // __KV_V288: repeated asks with no ask appearing = the seat is wedged mid-turn\n' +
'          M.__askN = (M.__askSeat===exp) ? (M.__askN||0)+1 : 1;\n' +
'          M.__askSeat = exp;\n' +
'          if(M.__askN>3){\n' +
'            M.__askN=0;\n' +
'            // did this seat roll and never close it?\n' +
'            var mvA=(window.KV_MOVES||[]), lrA=null;\n' +
'            for(var ai=mvA.length-1;ai>=0;ai--){ var ra=mvA[ai]; if(ra && ra.__acked && String(ra.a)==="roll"){ lrA=ra; break; } }\n' +
'            var openTurn=false;\n' +
'            if(lrA && lrA.s===exp){\n' +
'              openTurn=true;\n' +
'              for(var aj=mvA.length-1;aj>=0;aj--){ var qa=mvA[aj]; if(!qa||!qa.__acked) continue; if(qa.i<=lrA.i) break;\n' +
'                if(qa.s===exp && /^(buy|pass|end)$/.test(String(qa.a))){ openTurn=false; break; } }\n' +
'            }\n' +
'            if(openTurn && window.KV_MOVE){\n' +
'              log("turn: P"+exp+" never closed its roll \\u2014 recording pass", "#e0a040");\n' +
'              window.KV_MOVE(exp, "pass", 0);\n' +
'              return;\n' +
'            }\n' +
'          }\n' +
'          if(window.KV_SETSTATE){\n' +
'            window.KV_SETSTATE("rollshow",0); window.KV_SETSTATE("rollv",0); window.KV_SETSTATE("rollt",0);\n' +
'            window.KV_SETSTATE("asked",0); window.KV_SETSTATE("go",0);\n' +
'          }\n' +
'          log("turn: asking P"+exp+" to roll", "#caa64c");\n' +
'          return;');

// reset the ask counter whenever the controller steps seats
s = s.split('        log("turn: P"+exp+" to act (engine was on P"+seatNow+")", "#9cd87c");')
     .join('        M.__askN=0; M.__askSeat=null;   // __KV_V288\n' +
           '        log("turn: P"+exp+" to act (engine was on P"+seatNow+")", "#9cd87c");');

fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
