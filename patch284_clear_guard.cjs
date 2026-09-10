// patch284_clear_guard.cjs — 283 cleared roll-display state on every step, including the
// gate-refusal stepper, which made bots re-roll instantly and spam refusals. Now:
//   * KV_CLEAR_DICE is a no-op unless the seat actually changed since the last clear
//   * it is removed entirely from the gate-refusal path (that step must not invite a re-roll)
//   * a 1200ms floor between clears, so no loop can form
// SRC showcase_kascity283.html -> DST showcase_kascity284.html
const fs = require("fs");
const SRC = "showcase_kascity283.html";
const DST = "showcase_kascity284.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

const H = '  window.KV_CLEAR_DICE=function(){\n' +
'    try{\n' +
'      if(!window.KV_SETSTATE) return;\n' +
'      window.KV_SETSTATE("rollshow",0);\n' +
'      window.KV_SETSTATE("rollv",0);\n' +
'      window.KV_SETSTATE("rollt",0);\n' +
'    }catch(e){}\n' +
'  };';

if (s.split(H).length - 1 !== 1) {
  console.error("ABORT — KV_CLEAR_DICE from 283 not found");
  process.exit(1);
}

// guarded version
s = s.replace(H,
'  window.__KV_CLR={ seat:null, at:0 };\n' +
'  window.KV_CLEAR_DICE=function(seatFor){\n' +
'    try{\n' +
'      if(!window.KV_SETSTATE) return;\n' +
'      var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};\n' +
'      var sNow=(seatFor!=null?seatFor:(f.seat||1));\n' +
'      var C=window.__KV_CLR;\n' +
'      // __KV_V284: only on a genuine seat change, and never more than once per 1.2s\n' +
'      if(C.seat===sNow && Date.now()-C.at<1200) return;\n' +
'      if(C.seat===sNow) return;\n' +
'      C.seat=sNow; C.at=Date.now();\n' +
'      window.KV_SETSTATE("rollshow",0);\n' +
'      window.KV_SETSTATE("rollv",0);\n' +
'      window.KV_SETSTATE("rollt",0);\n' +
'    }catch(e){}\n' +
'  };');

// remove the clear from the gate-refusal stepper (283 added it after go=__goR)
s = s.split('window.KV_SETSTATE("go",__goR); if(window.KV_CLEAR_DICE) window.KV_CLEAR_DICE();')
     .join('window.KV_SETSTATE("go",__goR);');

fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
