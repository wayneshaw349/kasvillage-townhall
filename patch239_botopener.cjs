// patch239_botopener.cjs
// SRC showcase_kascity238.html -> DST showcase_kascity239.html
// Screenshot diagnosis: RESYNC(stagnant 20s) looped -- each pass stepped the engine to
// P3 (a bot) but nothing opened the bot's turn, so the game re-stalled and the repeated
// engine resets wiped rendering and left stale prompts.
//   P1: resync steps the engine only when it is actually off the expected seat.
//   P2: after resync, if the expected seat is a host-owned bot, the host opens its
//       turn (go=0) after 800ms.
//   P3: stagnation trigger B only refetches when the chain is ahead (head > logN);
//       otherwise, on the host, it opens the stalled bot's turn directly.
//   P4: standing host bot opener -- any bot seat idle 6s with no modal gets kicked.
// Count-guarded, CRLF-safe, abort-before-write.

const fs = require("fs");
const SRC = "showcase_kascity238.html";
const DST = "showcase_kascity239.html";

let raw = fs.readFileSync(SRC, "utf8");
const hadCRLF = raw.indexOf("\r\n") >= 0;
let s = hadCRLF ? raw.replace(/\r\n/g, "\n") : raw;

const errs = [];
function count(h, n){ return h.split(n).length - 1; }
function rep(label, o, n, expect){
  expect = expect == null ? 1 : expect;
  const c = count(s, o);
  if (c !== expect) { errs.push(`[${label}] anchor count ${c}, expected ${expect}`); return; }
  s = s.split(o).join(n);
}

// ---------- P1: step only when off-seat ----------
rep("P1-step-guard",
`        exp = (String(lastMove.a)==="roll") ? lastMove.s : ((lastMove.s%4)+1);
      }
      if(window.KV_SETSTATE){`,
`        exp = (String(lastMove.a)==="roll") ? lastMove.s : ((lastMove.s%4)+1);
      }
      var __fNow=(window.KV_FLAGS&&window.KV_FLAGS())||{};
      if(window.KV_SETSTATE && (__fNow.seat||1)!==exp){`);

// ---------- P2: post-resync bot opener ----------
rep("P2-postresync-bot",
  '      console.log("[KV RESYNC]", reason||"manual", entries.length, "-> P"+exp);',
`      console.log("[KV RESYNC]", reason||"manual", entries.length, "-> P"+exp);
      if(M.role==="host" && M.roster.length && exp>M.roster.length){
        setTimeout(function(){ try{
          if(window.KV_SETSTATE){ window.KV_SETSTATE("go",0); log("opening bot P"+exp+"'s turn after resync","#caa64c"); }
        }catch(e){} }, 800);
      }`);

// ---------- P3: trigger B -- refetch only when the chain is ahead ----------
rep("P3-triggerB",
`        // B: nothing moving anywhere for 20s -> requery the chain
        if(idle>20000 && !modal){ M.resync("stagnant 20s"); }`,
`        // B: stagnant AND the chain holds entries we have not applied -> requery
        if(idle>20000 && !modal){
          if((M.head||0) > (M.logN||0)){ M.resync("stagnant, chain ahead"); }
          else if(M.role==="host"){
            var mvB=(window.KV_MOVES||[]), lm=null;
            for(var bqi=mvB.length-1;bqi>=0;bqi--){ if(mvB[bqi]){ lm=mvB[bqi]; break; } }
            var expB = lm ? ((String(lm.a)==="roll")?lm.s:((lm.s%4)+1)) : null;
            if(expB && M.roster.length && expB>M.roster.length && window.KV_SETSTATE){
              log("bot P"+expB+" stalled \\u2014 opening its turn","#e0a040");
              window.KV_SETSTATE("turn",expB-1); window.KV_SETSTATE("seat",expB); window.KV_SETSTATE("go",0);
              lastAt=Date.now();
            }
          }
        }`);

// ---------- P4: standing host bot opener ----------
rep("P4-bot-opener",
  "  // ---- status strip ----",
`  // ---- __KV_V239: host bot opener -- a bot's turn never waits on a human tap ----
  (function(){
    var lastN=-1, lastAt=Date.now();
    setInterval(function(){
      try{
        if(M.role!=="host" || !M.started || M.halted) return;
        var n=(window.KV_MOVES||[]).length;
        if(n!==lastN){ lastN=n; lastAt=Date.now(); return; }
        if(Date.now()-lastAt<6000) return;
        if(document.querySelector("[data-kvmodal]")) return;
        var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};
        var seatNow=f.seat||(((f.turn||0)%4)+1);
        if(!(M.roster.length && seatNow>M.roster.length)) return;   // not a bot seat
        log("bot P"+seatNow+" idle \\u2014 kicking its roll","#caa64c");
        if(window.KV_SETSTATE) window.KV_SETSTATE("go",0);
        lastAt=Date.now();
      }catch(e){}
    }, 2000);
  })();

  // ---- status strip ----`);

if (errs.length) {
  console.error("ABORT -- nothing written:");
  errs.forEach(function(e){ console.error("  " + e); });
  process.exit(1);
}

let out = hadCRLF ? s.replace(/\n/g, "\r\n") : s;
fs.writeFileSync(DST, out, "utf8");
const chk = fs.readFileSync(DST, "utf8");
const must = ["__KV_V239: host bot opener", "opening bot P", "stagnant, chain ahead"];
const missing = must.filter(function(x){ return chk.indexOf(x) < 0; });
if (missing.length) { console.error("POST-WRITE CHECK FAILED", missing); process.exit(1); }
console.log("OK -> " + DST + "  (" + chk.length + " chars)");
