// patch287_show_detail.cjs — surface the relay's refusal detail (which invariant fired) and,
// for bad_transition, dump the snapshots either side so the cause is visible in one line.
// SRC showcase_kascity286.html -> DST showcase_kascity287.html
const fs = require("fs");
const SRC = "showcase_kascity286.html";
const DST = "showcase_kascity287.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

const A = 'log("relay refused "+r.a+" P"+r.s+": "+o.reason+(o.expect!=null?(" (expects P"+o.expect+")"):""), "#e0a040");';
const c = s.split(A).length - 1;
if (c !== 1) {
  console.error("ABORT — anchor found " + c + " times (expected 1)");
  process.exit(1);
}

s = s.replace(A,
'log("relay refused "+r.a+" P"+r.s+": "+o.reason+(o.detail?(" ["+o.detail+"]"):"")+(o.expect!=null?(" (expects P"+o.expect+")"):""), "#e0a040");\n' +
'              if(o.reason==="bad_transition"){\n' +
'                try{\n' +
'                  var __prev=null, __mvD=(window.KV_MOVES||[]);\n' +
'                  for(var __d=__mvD.length-1;__d>=0;__d--){ var __q=__mvD[__d]; if(__q && __q!==r && __q.__acked && __q.snap){ __prev=__q; break; } }\n' +
'                  console.warn("[KV BAD_TRANSITION]", o.detail||"?", {\n' +
'                    action:r.a, seat:r.s, v:r.v, d1:r.d1, d2:r.d2,\n' +
'                    prevSnap:(__prev?__prev.snap:null), prevAt:(__prev?__prev.i:null), prevAction:(__prev?__prev.a:null),\n' +
'                    nextSnap:r.snap\n' +
'                  });\n' +
'                  log("  detail: "+(o.detail||"?")+" \\u00b7 prev@"+(__prev?__prev.i:"-")+" "+(__prev?__prev.snap:"-"), "#8a7a5a");\n' +
'                  log("  ours:   "+(r.snap||"-"), "#8a7a5a");\n' +
'                }catch(eD){}\n' +
'              }');

fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
