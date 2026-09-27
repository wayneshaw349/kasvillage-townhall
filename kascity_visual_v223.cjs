// kascity_visual_v223.cjs — the turn gate gets a lag breaker
// A human turn can end without any recordable action (aborted offer, idle ask):
// the mover's engine advances, but the peer's engine stays on that seat (phase 21)
// and the drain's turn gate blocks every later move until the 30s force-adopt.
// Now: if the queue head is turn-bound for seat s and the local engine has sat on
// a different seat for ~4s, the engine is stepped onto seat s (the same flag reset
// the opener uses) so the queued move can apply normally.
const fs = require("fs");
const SRC = "showcase_kascity222.html";
const DST = "showcase_kascity223.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V223") !== -1) { console.error("ABORT: v223 already applied."); process.exit(1); }

const A1 = `    var turnBound=/^(roll|buy|pass|first)$/.test(String(m.a));
    if(turnBound && (f.seat||1)!==m.s){ return; }`;
const c = s.split(A1).length - 1;
if (c !== 1) { console.error("ABORT: anchor count " + c + " (expected 1). File untouched."); process.exit(1); }

s = s.replace(A1,
`    var turnBound=/^(roll|buy|pass|first)$/.test(String(m.a));
    if(turnBound && (f.seat||1)!==m.s){
      // __KV_V223: lag breaker — the mover has moved on; step our engine to their seat
      M.lagN=(M.lagN||0)+1;
      if(M.lagN>10 && String(m.a)!=="first" && window.KV_SETSTATE){
        M.lagN=0;
        log("engine lagging on P"+(f.seat||1)+" — stepping to P"+m.s+" for move "+m.i, "#e0a040");
        window.KV_SETSTATE("turn", m.s-1); window.KV_SETSTATE("seat", m.s);
        window.KV_SETSTATE("phase",0); window.KV_SETSTATE("moved",0);
        window.KV_SETSTATE("asked",0); window.KV_SETSTATE("go",-1);
        window.KV_SETSTATE("buy",-1); window.KV_SETSTATE("buy_tile",-1);
      }
      return; }
    M.lagN=0;`);

fs.writeFileSync(DST, s);
console.log("PASS anchor 1/1 — turn-gate lag breaker installed");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
