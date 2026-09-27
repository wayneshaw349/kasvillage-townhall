// kascity_visual_v226.cjs — the log decides whose turn it is
// Both boards idled with empty queues, one engine on seat 2 and the other on
// seat 3: force-adopts + dice corrections drifted the local turn pointers apart,
// and each board waited forever for the other's human. The shared move log is
// the authority: the seat after the last recorded roll is the expected actor.
// A 2s watchdog steps a stalled engine (no seat change, empty queue, ~8s idle)
// onto that expected seat using the same flag reset the opener uses.
const fs = require("fs");
const SRC = "showcase_kascity225.html";
const DST = "showcase_kascity226.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V226") !== -1) { console.error("ABORT: v226 already applied."); process.exit(1); }

const A1 = `  // ---- status strip ----`;
const c = s.split(A1).length - 1;
if (c !== 1) { console.error("ABORT: anchor count " + c + " (expected 1). File untouched."); process.exit(1); }

s = s.replace(A1,
`  // ---- __KV_V226: turn-pointer watchdog — the shared log is the turn authority ----
  (function(){
    var lastSeat=null, lastChange=Date.now();
    setInterval(function(){
      try{
        if(!M.started || M.halted) return;
        if((M.queue||[]).length) return;                      // drain is working; leave it alone
        var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};
        var seatNow=f.seat||(((f.turn||0)%4)+1);
        if(seatNow!==lastSeat){ lastSeat=seatNow; lastChange=Date.now(); return; }
        if(Date.now()-lastChange<8000) return;                // engine may just be thinking
        if(document.querySelector("[data-kvmodal]")) return;  // a human is mid-dialog
        var mv=(window.KV_MOVES||[]), lastRoll=null;
        for(var i=mv.length-1;i>=0;i--){ var r=mv[i]; if(r && String(r.a)==="roll"){ lastRoll=r; break; } }
        if(!lastRoll) return;
        var exp=(lastRoll.s%4)+1;
        if(seatNow===exp) return;
        log("turn watchdog: log says P"+exp+" is next (engine on P"+seatNow+") — stepping", "#e0a040");
        if(window.KV_SETSTATE){
          window.KV_SETSTATE("turn", exp-1); window.KV_SETSTATE("seat", exp);
          window.KV_SETSTATE("phase",0); window.KV_SETSTATE("moved",0);
          window.KV_SETSTATE("asked",0); window.KV_SETSTATE("go",-1);
          window.KV_SETSTATE("buy",-1); window.KV_SETSTATE("buy_tile",-1);
        }
        lastChange=Date.now();
      }catch(e){}
    }, 2000);
  })();

  // ---- status strip ----`);

fs.writeFileSync(DST, s);
console.log("PASS anchor 1/1 — turn watchdog installed; the log decides whose turn it is");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
