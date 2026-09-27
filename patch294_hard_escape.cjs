// patch294_hard_escape.cjs — 288's escape never fired because it depended on the local record of
// the roller being acked. Make it unconditional and chain-based: if the controller has asked the
// same seat 4+ times (~20s) and the chain head has not moved in that window, post a pass for that
// seat. A pass is always legal for the seat the relay expects, so this cannot desync anything.
// SRC showcase_kascity293.html -> DST showcase_kascity294.html
const fs = require("fs");
const SRC = "showcase_kascity293.html";
const DST = "showcase_kascity294.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\n/g, "\n").replace(/\r\n/g, "\n");
const fails = [];
function need(a, n, label){ const c = s.split(a).length - 1; if (c !== n) fails.push(label + ": expected " + n + " found " + c); }

const A = '          M.__askN = (M.__askSeat===exp) ? (M.__askN||0)+1 : 1;\n' +
'          M.__askSeat = exp;';

need(A, 1, "A ask counter (288)");
if (fails.length) { console.error("ABORT — anchors:\n" + fails.join("\n")); process.exit(1); }

s = s.replace(A,
'          M.__askN = (M.__askSeat===exp) ? (M.__askN||0)+1 : 1;\n' +
'          if(M.__askSeat!==exp){ M.__askHead = (M.head!=null?M.head:M.logN)||0; }\n' +
'          M.__askSeat = exp;\n' +
'          // __KV_V294: the chain has not moved while we asked this seat repeatedly -> close it\n' +
'          var __headNow=(M.head!=null?M.head:M.logN)||0;\n' +
'          if(M.__askN>=4 && __headNow===(M.__askHead||0)){\n' +
'            M.__askN=0; M.__askHead=__headNow;\n' +
'            if(window.KV_MOVE){\n' +
'              log("turn: P"+exp+" is not responding \\u2014 recording pass to move the chain on", "#e0a040");\n' +
'              window.KV_MOVE(exp, "pass", 0);\n' +
'              return;\n' +
'            }\n' +
'          }\n' +
'          if(__headNow!==(M.__askHead||0)){ M.__askHead=__headNow; M.__askN=1; }');

fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
