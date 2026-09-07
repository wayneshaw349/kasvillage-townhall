// kascity_visual_v214.cjs — one click per remote move
// The drain clicked the hidden prompt on assertN 1,3,6,... — if the engine had already
// recorded the move but consumed() hadn't run yet, the second click made the engine
// record the SAME remote move again (i7+i8 P2roll dup), shifting every later index.
// Fix: before dispatching the click, if a local record matching (m.i or the current
// head) already carries this seat+action, skip the click — the next tick consumes it.
const fs = require("fs");
const SRC = "showcase_kascity213.html";
const DST = "showcase_kascity214.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V214") !== -1) { console.error("ABORT: v214 already applied."); process.exit(1); }

const A1 = `    try{
      var a=String(m.a||""), choice=null;
      if(a==="roll"||a==="buy") choice=0; else if(a==="pass") choice=1;
      if(choice!==null){`;
const c = s.split(A1).length - 1;
if (c !== 1) { console.error("ABORT: anchor count " + c + " (expected 1). File untouched."); process.exit(1); }

s = s.replace(A1,
`    try{
      var a=String(m.a||""), choice=null;
      if(a==="roll"||a==="buy") choice=0; else if(a==="pass") choice=1;
      // __KV_V214: never click twice for the same remote move — if any recent local
      // record already carries this seat+action and is at/after m.i, the engine has
      // recorded it; wait for consumed() instead of generating a duplicate.
      if(choice!==null){
        var __mv=(window.KV_MOVES||[]);
        for(var __k=Math.max(0,m.i); __k<__mv.length; __k++){
          var __r=__mv[__k];
          if(__r && __r.s===m.s && String(__r.a)===String(m.a)){ choice=null; break; }
        }
      }
      if(choice!==null){`);

fs.writeFileSync(DST, s);
console.log("PASS anchor 1/1 — remote prompt clicked at most once per move");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
