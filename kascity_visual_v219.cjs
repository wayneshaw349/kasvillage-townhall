// kascity_visual_v219.cjs — never drop a relayed move: force-adopt on timeout
// The 30s skip removed the move from the queue and forgot it — a permanent hole
// in the local log; the engine then waits on that seat forever (the freeze after
// a buy). Update model: the mover's record IS the record. On timeout we write the
// move into KV_MOVES at its relay index (hash+snap included), adopt the snapshot,
// and continue.
const fs = require("fs");
const SRC = "showcase_kascity218.html";
const DST = "showcase_kascity219.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V219") !== -1) { console.error("ABORT: v219 already applied."); process.exit(1); }

const A1 = `    if(M.assertN>75){ log("relay move "+m.i+" ("+m.a+" P"+m.s+") not consumed after 30s — skipping","#ff6a4a"); M.queue.shift(); M.assertN=0; }`;
const c = s.split(A1).length - 1;
if (c !== 1) { console.error("ABORT: anchor count " + c + " (expected 1). File untouched."); process.exit(1); }

s = s.replace(A1,
`    if(M.assertN>75){
      // __KV_V219: force-adopt instead of dropping — the mover's record is the record
      try{
        var mv=(window.KV_MOVES||[]);
        if(!mv[m.i]){ mv[m.i]={ i:m.i, s:m.s, a:m.a, v:m.v, t:m.t, hash:m.hash||null, snap:m.snap||null }; }
        if(window.KV_ADOPT && m.snap) window.KV_ADOPT(m.snap);
        log("relay move "+m.i+" ("+m.a+" P"+m.s+") not consumed after 30s — force-adopted","#e0a040");
        console.warn("[KV FORCE-ADOPT] i"+m.i, m.a, "P"+m.s);
      }catch(e){}
      M.queue.shift(); M.assertN=0; }`);

fs.writeFileSync(DST, s);
console.log("PASS anchor 1/1 — timeouts force-adopt; no permanent local holes");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
