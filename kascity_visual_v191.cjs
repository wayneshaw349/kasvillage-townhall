// kascity_visual_v191.cjs — kick the opening bot turn
// Both clients reached "engine running" on the DAA gun but nothing moved (clock 420, no
// rolls). In the v189 run, pressing Roll during P3's turn made the engine roll for P3 —
// Roll means "current seat rolls now" (the relay already maps a remote roll to
// KV_SETSTATE("go",0)), and the engine never auto-rolls an opening bot turn without it.
// Fix: after GO, once the roll-for-first has settled, the HOST kicks go=0 if the seat on
// turn is a bot (seat > roster length). A human opener taps Roll as usual and it relays.
const fs = require("fs");
const SRC = "showcase_kascity190.html";
const DST = "showcase_kascity191.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V191") !== -1) { console.error("ABORT: v191 already applied."); process.exit(1); }

const A1 = `        if(f.t0>0){ log("engine running", "#9cd87c"); return; }`;
const c1 = s.split(A1).length - 1;
if (c1 !== 1) { console.error("ABORT: engine-running anchor count " + c1 + " (expected 1). File untouched."); process.exit(1); }

s = s.replace(A1,
`        if(f.t0>0){
          log("engine running", "#9cd87c");
          // __KV_V191: the host opens a bot's first turn; humans open their own by tapping Roll
          if(M.role==="host"){
            (function openBot(t2){
              var g=(window.KV_FLAGS&&window.KV_FLAGS())||{};
              var rolled=(window.KV_MOVES||[]).some(function(m){ return m.a==="roll"; });
              if(rolled) return;
              var firstDone=(window.KV_MOVES||[]).filter(function(m){ return m.a==="first"; }).length>=4
                            && !document.querySelector("[data-kvmodal]");
              if(!firstDone){ if(t2<80) setTimeout(function(){ openBot(t2+1); }, 300); return; }
              var seat=g.seat||(((g.turn||0)%4)+1);
              var isBot = M.roster.length && seat>M.roster.length;
              if(isBot){ log("opening bot P"+seat+"'s turn", "#caa64c"); if(window.KV_SETSTATE) window.KV_SETSTATE("go",0); }
              else log("P"+seat+" opens — that player taps Roll", "#caa64c");
            })(0);
          }
          return;
        }`);

fs.writeFileSync(DST, s);
console.log("PASS anchor 1/1 — host kicks the opening bot turn after roll-for-first settles");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
