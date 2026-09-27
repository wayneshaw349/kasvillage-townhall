// patch234_rollfix.cjs
// SRC showcase_kascity233.html -> DST showcase_kascity234.html
// Diagnosis from guest console: v232 self-heal adopted the same snapshot repeatedly
// (i4 x7, i5 x11), each pass resetting phase/asked/go and wiping the engine's pending
// roll prompt. Fix:
//   P1: self-heal adopts each record ONCE, and only steps seat state when the engine
//       is not already on the expected seat.
//   P2: roll-prompt restorer -- when it is OUR seat's turn, queue is drained, no modal
//       and no engine prompt is visible, re-ask (phase/moved/asked/go reset), at most
//       once per 6s per turn-key.
// Count-guarded, CRLF-safe, abort-before-write.

const fs = require("fs");
const SRC = "showcase_kascity233.html";
const DST = "showcase_kascity234.html";

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
function span(label, a0, a1, n){
  const c0 = count(s, a0), c1 = count(s, a1);
  if (c0 !== 1) { errs.push(`[${label}] start count ${c0}`); return; }
  if (c1 !== 1) { errs.push(`[${label}] end count ${c1}`); return; }
  const i0 = s.indexOf(a0), i1 = s.indexOf(a1);
  if (i1 < i0) { errs.push(`[${label}] end before start`); return; }
  s = s.slice(0, i0) + n + s.slice(i1 + a1.length);
}

// ---------- P1: self-heal -- once per record, step only when needed ----------
span("P1-selfheal",
`        if(!pick) return;`,
`        console.log("[KV SELF-HEAL] i"+pick.i, "->", "P"+exp);`,
`        if(!pick) return;
        if(M.__healI===pick.i){ lastProgress=Date.now(); return; }   // __KV_V234: adopt each record once
        M.__healI=pick.i;
        if(window.KV_ADOPT) window.KV_ADOPT(pick.snap);
        var exp=(pick.s%4)+1;
        var __cur=(f.seat||1);
        if(window.KV_SETSTATE && __cur!==exp){
          window.KV_SETSTATE("turn", exp-1); window.KV_SETSTATE("seat", exp);
          window.KV_SETSTATE("phase",0); window.KV_SETSTATE("moved",0);
          window.KV_SETSTATE("asked",0); window.KV_SETSTATE("go",-1);
          window.KV_SETSTATE("buy",-1); window.KV_SETSTATE("buy_tile",-1);
        }
        log("self-heal: snapshot "+pick.i+" (P"+pick.s+") engine P"+__cur+"->P"+exp, "#9cd87c");
        console.log("[KV SELF-HEAL] i"+pick.i, "->", "P"+exp);`);

// ---------- P2: roll-prompt restorer, inserted before the status strip ----------
rep("P2-restorer",
  "  // ---- status strip ----",
`  // ---- __KV_V234: roll-prompt restorer -- our turn, nothing on screen: re-ask ----
  (function(){
    var lastKey=null, lastAt=0;
    setInterval(function(){
      try{
        if(!M.started || M.halted) return;
        if((M.queue||[]).length) return;
        var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};
        if((f.seat||1)!==M.seat) return;
        if(document.querySelector("[data-kvmodal]")) return;
        if(document.querySelector("div[data-i]")) return;      // a prompt is already up
        var mv=(window.KV_MOVES||[]), lastRoll=null;
        for(var i=mv.length-1;i>=0;i--){ var r=mv[i]; if(r && String(r.a)==="roll"){ lastRoll=r; break; } }
        if(lastRoll && lastRoll.s===M.seat) return;            // we already rolled this turn
        var key=(f.turn||0)+"/"+M.seat+"/"+mv.length;
        if(key===lastKey && Date.now()-lastAt<6000) return;
        lastKey=key; lastAt=Date.now();
        log("re-asking the engine for P"+M.seat+"'s roll", "#caa64c");
        if(window.KV_SETSTATE){
          window.KV_SETSTATE("phase",0); window.KV_SETSTATE("moved",0);
          window.KV_SETSTATE("asked",0); window.KV_SETSTATE("go",-1);
        }
      }catch(e){}
    }, 2500);
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
const must = ["__KV_V234: adopt each record once", "__KV_V234: roll-prompt restorer"];
const missing = must.filter(function(x){ return chk.indexOf(x) < 0; });
if (missing.length) { console.error("POST-WRITE CHECK FAILED", missing); process.exit(1); }
console.log("OK -> " + DST + "  (" + chk.length + " chars)");
