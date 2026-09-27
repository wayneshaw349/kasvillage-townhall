// kascity_visual_v232.cjs — local self-heal from snapshots already in hand
// (replaces the abandoned beacon design: no new relay traffic, nothing enters
// the move log). Every relayed move already carries the mover's snapshot
// (v210/v211). If this client stalls — no new records for 8s while it isn't
// our own human's decision — it takes the highest-index record that has a
// snapshot, adopts it, and steps the engine to the seat after that mover.
// Repeats every few seconds until play moves again.
const fs = require("fs");
const SRC = "showcase_kascity230.html";
const DST = "showcase_kascity232.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V232") !== -1) { console.error("ABORT: v232 already applied."); process.exit(1); }

const A1 = `  // ---- __KV_V228: answer incoming remote bids for seats this device owns ----`;
const c = s.split(A1).length - 1;
if (c !== 1) { console.error("ABORT: anchor count " + c + " (expected 1). File untouched."); process.exit(1); }

s = s.replace(A1,
`  // ---- __KV_V232: local self-heal — adopt the newest snapshot already received ----
  (function(){
    var lastLen=0, lastProgress=Date.now();
    setInterval(function(){
      try{
        if(!M.started || M.halted) return;
        var mv=(window.KV_MOVES||[]);
        if(mv.length!==lastLen){ lastLen=mv.length; lastProgress=Date.now(); return; }
        if(Date.now()-lastProgress<8000) return;
        var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};
        if((f.seat||1)===M.seat && !(M.queue||[]).length) { lastProgress=Date.now(); return; }  // our human is deciding
        // newest record carrying a snapshot
        var pick=null;
        for(var i=mv.length-1;i>=0;i--){ var r=mv[i]; if(r && r.snap){ pick=r; break; } }
        if(!pick) return;
        if(window.KV_ADOPT) window.KV_ADOPT(pick.snap);
        var exp=(pick.s%4)+1;
        if(window.KV_SETSTATE){
          window.KV_SETSTATE("turn", exp-1); window.KV_SETSTATE("seat", exp);
          window.KV_SETSTATE("phase",0); window.KV_SETSTATE("moved",0);
          window.KV_SETSTATE("asked",0); window.KV_SETSTATE("go",-1);
          window.KV_SETSTATE("buy",-1); window.KV_SETSTATE("buy_tile",-1);
        }
        log("self-heal: adopted snapshot from move "+pick.i+" (P"+pick.s+" "+pick.a+") — engine to P"+exp, "#9cd87c");
        console.log("[KV SELF-HEAL] i"+pick.i, "->", "P"+exp);
        lastProgress=Date.now();
      }catch(e){}
    }, 3000);
  })();

  // ---- __KV_V228: answer incoming remote bids for seats this device owns ----`);

fs.writeFileSync(DST, s);
console.log("PASS anchor 1/1 — local self-heal installed (no new relay traffic)");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
