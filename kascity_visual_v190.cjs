// kascity_visual_v190.cjs — the DAA gun starts the engine on every client
// Relay inspection showed the host's bot moves (P3 roll/buy, P4 roll) stored correctly;
// the guest never executed them because its engine clock (t0) only starts on a first
// pointer tap, which nobody gave it. Solo play gets that tap from pressing Roll.
// Fix: on GO, the gun dispatches the same synthetic pointerdown the roll-for-first code
// uses (canvas + document), retrying until KV_FLAGS().t0 > 0 — so both engines start on
// the same DAA score with no human input required.
const fs = require("fs");
const SRC = "showcase_kascity189.html";
const DST = "showcase_kascity190.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V190") !== -1) { console.error("ABORT: v190 already applied."); process.exit(1); }

const A1 = `      try{ if(window.__KV_LOBBY_OV) window.__KV_LOBBY_OV.remove(); }catch(e){}
      log("GO — "+n+" players, seat P"+(M.seat||1)+", DAA "+startDaa, "#9cd87c");`;

const c1 = s.split(A1).length - 1;
if (c1 !== 1) { console.error("ABORT: GO anchor count " + c1 + " (expected 1). File untouched."); process.exit(1); }

s = s.replace(A1,
`      try{ if(window.__KV_LOBBY_OV) window.__KV_LOBBY_OV.remove(); }catch(e){}
      log("GO — "+n+" players, seat P"+(M.seat||1)+", DAA "+startDaa, "#9cd87c");
      // __KV_V190: start the engine here, on the shared gun, not on a human tap
      (function kick(tries){
        var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};
        if(f.t0>0){ log("engine running", "#9cd87c"); return; }
        if(tries>40){ log("engine did not start — tap the board", "#ff6a4a"); return; }
        try{
          var c=document.querySelector("canvas");
          if(c){ var r=c.getBoundingClientRect();
            var o={bubbles:true,cancelable:true,clientX:r.left+3,clientY:r.top+3,pointerId:1,pointerType:"mouse",isPrimary:true,button:0};
            c.dispatchEvent(new PointerEvent("pointerdown",o));
            c.dispatchEvent(new PointerEvent("pointerup",o)); }
          document.dispatchEvent(new Event("pointerdown"));
        }catch(e){}
        setTimeout(function(){ kick(tries+1); }, 250);
      })(0);`);

fs.writeFileSync(DST, s);
console.log("PASS anchor 1/1 — gun auto-starts the engine on every client");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
