// patch271_gate_authority.cjs — a gate refusal (not_your_turn / not_the_roller / opener_*) means the
// move never happened: delete the local record (no retry) and step the engine straight to the seat the
// relay says it expects. Non-gate failures keep the old retry/resync path.
// SRC showcase_kascity270.html -> DST showcase_kascity271.html
const fs = require("fs");
const SRC = "showcase_kascity270.html";
const DST = "showcase_kascity271.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

const A = '              r.__sent=0;\n' +
'              log("relay refused "+r.a+" P"+r.s+": "+o.reason+(o.expect!=null?(" (expects P"+o.expect+")"):""), "#e0a040");\n' +
'              if(M.resync) M.resync("relay refused "+r.a);\n' +
'              return;';

const c = s.split(A).length - 1;
if (c !== 1) {
  console.error("ABORT — anchor found " + c + " times (expected 1)");
  process.exit(1);
}

const B =
'              log("relay refused "+r.a+" P"+r.s+": "+o.reason+(o.expect!=null?(" (expects P"+o.expect+")"):""), "#e0a040");\n' +
'              // __KV_V271: gate refusal = the move never happened; the relay\'s expect is authoritative\n' +
'              var __gate=/not_your_turn|not_the_roller|opener_mismatch|not_the_opener/.test(String(o.reason||""));\n' +
'              if(__gate){\n' +
'                var mvG=(window.KV_MOVES||[]);\n' +
'                if(mvG[r.i]===r) delete mvG[r.i];\n' +
'                r.__sent=1; r.__acked=1; r.__dropped=1;\n' +
'                var ex=+o.expect;\n' +
'                if(ex>=1 && ex<=4 && window.KV_SETSTATE){\n' +
'                  window.KV_SETSTATE("turn", ex-1); window.KV_SETSTATE("seat", ex);\n' +
'                  window.KV_SETSTATE("phase",0); window.KV_SETSTATE("moved",0);\n' +
'                  var __goR=(ex===M.seat || (M.owns&&M.owns(ex))) ? -1 : 0;\n' +
'                  window.KV_SETSTATE("asked",0); window.KV_SETSTATE("go",__goR);\n' +
'                  log("stepped to relay\'s expected seat P"+ex, "#caa64c");\n' +
'                } else if(M.resync){ M.resync("relay refused "+r.a); }\n' +
'                return;\n' +
'              }\n' +
'              r.__sent=0;\n' +
'              if(M.resync) M.resync("relay refused "+r.a);\n' +
'              return;';

s = s.replace(A, B);
fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
