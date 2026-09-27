// patch263_advisory_drop.cjs — refused "end"/"court" moves are dropped (no retry, no resync); others unchanged
// SRC showcase_kascity262.html -> DST showcase_kascity263.html
const fs = require("fs");
const SRC = "showcase_kascity262.html";
const DST = "showcase_kascity263.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

const A = '            if(o && o.stored===false && o.reason){\n' +
'              r.__sent=0;\n' +
'              log("relay refused "+r.a+" P"+r.s+": "+o.reason+(o.expect!=null?(" (expects P"+o.expect+")"):""), "#e0a040");\n' +
'              if(M.resync) M.resync("relay refused "+r.a);\n' +
'              return;\n' +
'            }';

const c = s.split(A).length - 1;
if (c !== 1) {
  console.error("ABORT — anchor found " + c + " times (expected 1)");
  process.exit(1);
}

const B = '            if(o && o.stored===false && o.reason){\n' +
'              // __KV_V263: advisory moves (end/court) are best-effort — drop, no retry, no resync\n' +
'              var __adv=(String(r.a)==="end"||String(r.a)==="court");\n' +
'              if(__adv){\n' +
'                var mvA=(window.KV_MOVES||[]);\n' +
'                if(mvA[r.i]===r) delete mvA[r.i];\n' +
'                r.__sent=1; r.__acked=1; r.__dropped=1;\n' +
'                return;\n' +
'              }\n' +
'              r.__sent=0;\n' +
'              log("relay refused "+r.a+" P"+r.s+": "+o.reason+(o.expect!=null?(" (expects P"+o.expect+")"):""), "#e0a040");\n' +
'              if(M.resync) M.resync("relay refused "+r.a);\n' +
'              return;\n' +
'            }';

s = s.replace(A, B);
fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
