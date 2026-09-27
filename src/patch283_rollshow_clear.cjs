// patch283_rollshow_clear.cjs — a completed roll's display state (rollshow/rollt/rollv) survived
// resyncs and steps, so the engine considered the roll already shown and never asked again.
// Clears it wherever we reset a turn: resync, chain-truth enforcer, mid-fuse kick, end branch,
// gate-authority step, watchdog. Also gives the ROLL button a real fallback when no ask exists.
// SRC showcase_kascity282.html -> DST showcase_kascity283.html
const fs = require("fs");
const SRC = "showcase_kascity282.html";
const DST = "showcase_kascity283.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

// every place we reset a turn writes go last; append the dice-state clear after each
const RESET = 'window.KV_SETSTATE("asked",0); window.KV_SETSTATE("go",';
const count = s.split(RESET).length - 1;
if (count < 4) {
  console.error("ABORT — turn-reset sites found " + count + " (expected 4+)");
  process.exit(1);
}

// insert a helper once, near KV_MP2 diagnostics
const H = '  window.KV.why=function(){';
if (s.split(H).length - 1 !== 1) {
  console.error("ABORT — KV.why anchor not found");
  process.exit(1);
}
s = s.replace(H,
'  // __KV_V283: a fresh turn must not inherit the previous roll\'s display state\n' +
'  window.KV_CLEAR_DICE=function(){\n' +
'    try{\n' +
'      if(!window.KV_SETSTATE) return;\n' +
'      window.KV_SETSTATE("rollshow",0);\n' +
'      window.KV_SETSTATE("rollv",0);\n' +
'      window.KV_SETSTATE("rollt",0);\n' +
'    }catch(e){}\n' +
'  };\n' + H);

// after each turn reset, clear dice state (line-level: append a call after the go= statement's line end)
s = s.split('window.KV_SETSTATE("asked",0); window.KV_SETSTATE("go",-1);')
     .join('window.KV_SETSTATE("asked",0); window.KV_SETSTATE("go",-1); if(window.KV_CLEAR_DICE) window.KV_CLEAR_DICE();');
s = s.split('window.KV_SETSTATE("asked",0); window.KV_SETSTATE("go",0);')
     .join('window.KV_SETSTATE("asked",0); window.KV_SETSTATE("go",0); if(window.KV_CLEAR_DICE) window.KV_CLEAR_DICE();');
s = s.split('window.KV_SETSTATE("asked",0); window.KV_SETSTATE("go",__goE);')
     .join('window.KV_SETSTATE("asked",0); window.KV_SETSTATE("go",__goE); if(window.KV_CLEAR_DICE) window.KV_CLEAR_DICE();');
s = s.split('window.KV_SETSTATE("asked",0); window.KV_SETSTATE("go",__goR);')
     .join('window.KV_SETSTATE("asked",0); window.KV_SETSTATE("go",__goR); if(window.KV_CLEAR_DICE) window.KV_CLEAR_DICE();');
s = s.split('window.KV_SETSTATE("asked",0); window.KV_SETSTATE("go",__goW);')
     .join('window.KV_SETSTATE("asked",0); window.KV_SETSTATE("go",__goW); if(window.KV_CLEAR_DICE) window.KV_CLEAR_DICE();');
s = s.split('window.KV_SETSTATE("asked",0); window.KV_SETSTATE("go",go);')
     .join('window.KV_SETSTATE("asked",0); window.KV_SETSTATE("go",go); if(window.KV_CLEAR_DICE) window.KV_CLEAR_DICE();');

// ROLL button: clear dice state before the flag-step fallback so the ask can regenerate
const B = '            window.KV_SETSTATE("turn",M.seat-1); window.KV_SETSTATE("seat",M.seat);\n' +
'            window.KV_SETSTATE("phase",0); window.KV_SETSTATE("moved",0); window.KV_SETSTATE("asked",0);\n' +
'            window.KV_SETSTATE("go",0);';
if (s.split(B).length - 1 === 1) {
  s = s.replace(B,
'            if(window.KV_CLEAR_DICE) window.KV_CLEAR_DICE();   // __KV_V283\n' +
'            window.KV_SETSTATE("turn",M.seat-1); window.KV_SETSTATE("seat",M.seat);\n' +
'            window.KV_SETSTATE("phase",0); window.KV_SETSTATE("moved",0); window.KV_SETSTATE("asked",0);\n' +
'            window.KV_SETSTATE("go",0);');
}

fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
