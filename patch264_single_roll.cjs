// patch264_single_roll.cjs — shepherd + idle-kicker never re-trigger a roll already in progress
// Guard: if the engine shows moved>0 or phase>0 for the current turn, the roll happened — don't click/kick again.
// Shepherd backstop throttle 3s -> 10s.
// SRC showcase_kascity263.html -> DST showcase_kascity264.html
const fs = require("fs");
const SRC = "showcase_kascity263.html";
const DST = "showcase_kascity264.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");
const fails = [];
function must(a, n, label){ const c = s.split(a).length - 1; if (c !== n) fails.push(label + ": expected " + n + " found " + c); }

const A1 = '          if(hostBot && /Tap to roll/.test(ptxt)){';
const A2 = 'if(M.__shepAt[__shk] && Date.now()-M.__shepAt[__shk]<3000) return;';
const A3 = '        if(lrK && ((lrK.s%4)+1)!==seatNow) return;';

must(A1, 1, "A1 shepherd branch");
must(A2, 1, "A2 shepherd throttle");
must(A3, 1, "A3 kicker chain check");

if (fails.length) {
  console.error("ABORT — anchors:\n" + fails.join("\n"));
  process.exit(1);
}

s = s.replace(A1, A1 + "\n" +
'            if((f.moved||0)>0 || (f.phase||0)>0) return;   // __KV_V264: this turn already rolled / mid-turn');

s = s.replace(A2, 'if(M.__shepAt[__shk] && Date.now()-M.__shepAt[__shk]<10000) return;');

s = s.replace(A3, A3 + "\n" +
'        if((f.moved||0)>0 || (f.phase||0)>0) return;   // __KV_V264: engine already mid-turn \u2014 don\'t re-kick');

fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
