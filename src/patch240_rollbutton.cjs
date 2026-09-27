// patch240_rollbutton.cjs
// SRC showcase_kascity239.html -> DST showcase_kascity240.html
// The engine's behavior tree cannot be trusted to re-ask after adoption/resync, so the
// roll affordance stops depending on it:
//   P1: guaranteed ROLL button (fixed, bottom-left). Shown when (a) the engine is on
//       our seat and the last roll is not ours, or (b) the chain shows the previous
//       actor finished (buy/pass recorded) and we are next. Hidden when any engine
//       prompt or modal is visible. Click answers the engine's hidden "Tap to roll"
//       ask if present, else steps the engine to our seat and fires go=0.
//   P2: divergence detector cools down for 15s after any resync (kills the
//       resync->drift->resync churn that wiped rendering).
//   P3: KV.chain() -- dumps the relay log (i/kind/s/a/v/h + head + chain) and the
//       local mirror side by side for eyeball comparison.
// Count-guarded, CRLF-safe, abort-before-write.

const fs = require("fs");
const SRC = "showcase_kascity239.html";
const DST = "showcase_kascity240.html";

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

// ---------- P1: guaranteed ROLL button ----------
rep("P1-roll-button",
  "  // ---- status strip ----",
`  // ---- __KV_V240: guaranteed ROLL button -- the chain decides whose turn it is ----
  (function(){
    var btn=null;
    function ensure(){
      if(btn) return btn;
      btn=document.createElement("button");
      btn.textContent="\\u25b8 ROLL";
      btn.style.cssText="position:fixed;left:12px;bottom:64px;z-index:80;display:none;padding:12px 26px;background:#22303a;color:#cfe6f4;border:2px solid #4f7fd9;border-radius:8px;font:16px monospace;cursor:pointer;box-shadow:0 4px 18px rgba(0,0,0,.5);";
      btn.onclick=function(){
        try{
          var el=document.querySelector("div[data-i='0']");
          var txt=(el&&el.parentElement&&el.parentElement.parentElement)?el.parentElement.parentElement.textContent:"";
          if(el && /Tap to roll/.test(txt)){
            el.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true}));
            log("ROLL: answered the engine's ask","#9cd87c"); return;
          }
          if(window.KV_SETSTATE){
            window.KV_SETSTATE("turn",M.seat-1); window.KV_SETSTATE("seat",M.seat);
            window.KV_SETSTATE("phase",0); window.KV_SETSTATE("moved",0); window.KV_SETSTATE("asked",0);
            window.KV_SETSTATE("go",0);
            log("ROLL: stepped the engine to P"+M.seat+" and rolled","#9cd87c");
          }
        }catch(e){}
      };
      document.body.appendChild(btn);
      return btn;
    }
    function ourTurn(){
      var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};
      var mv=(window.KV_MOVES||[]), lr=null, lri=-1;
      for(var i=mv.length-1;i>=0;i--){ var r=mv[i]; if(r && String(r.a)==="roll"){ lr=r; lri=i; break; } }
      var rolledOurs = !!(lr && lr.s===M.seat);
      if(((f.seat||1)===M.seat) && !rolledOurs) return true;          // engine is on us, we have not rolled
      if(lr && lr.s!==M.seat){
        for(var j=lri+1;j<mv.length;j++){ var q=mv[j];
          if(q && q.s===lr.s && /^(buy|pass)$/.test(String(q.a))) return ((lr.s%4)+1)===M.seat; }
      }
      return false;
    }
    setInterval(function(){
      try{
        if(!M.started || M.halted){ if(btn) btn.style.display="none"; return; }
        var b=ensure();
        if(document.querySelector("[data-kvmodal]")){ b.style.display="none"; return; }
        var pr=document.querySelector("div[data-i]");
        if(pr && (pr.offsetWidth||pr.offsetHeight)){ b.style.display="none"; return; }   // engine UI is up
        b.style.display = ourTurn() ? "block" : "none";
      }catch(e){}
    }, 700);
  })();

  // ---- status strip ----`);

// ---------- P2: detector cooldown after resync ----------
rep("P2-cooldown",
  "        if(!pick || !window.KV_SNAPSHOT) return;",
`        if(!pick || !window.KV_SNAPSHOT) return;
        if(Date.now()-(M.__lastResync||0)<15000){ strikes=0; return; }   // __KV_V240: settle after resync`);

// ---------- P3: KV.chain() inspector ----------
rep("P3-kvchain",
  '    window.KV.resync=function(){ return M.resync("manual"); };   // __KV_V237',
`    window.KV.resync=function(){ return M.resync("manual"); };   // __KV_V237
    window.KV.chain=async function(){   // __KV_V240
      var L=await M.ord("/api/game/room/"+M.room+"/log?after=0");
      console.table((L.entries||[]).map(function(e){ return { i:e.i, kind:e.kind,
        s:e.body&&e.body.s, a:e.body&&e.body.a, v:e.body&&e.body.v, h:String(e.h||"").slice(0,12) }; }));
      console.log("relay head", L.head, "relay chain", L.chain);
      console.table((window.KV_MOVES||[]).filter(Boolean).map(function(r){ return { i:r.i, s:r.s, a:r.a, v:r.v, sent:!!r.__sent, snap:!!r.snap }; }));
      console.log("local KV_ROOT", window.KV_ROOT, "(different construction than the relay chain)");
      return { head:L.head, chain:L.chain, entries:(L.entries||[]).length, local:(window.KV_MOVES||[]).filter(Boolean).length };
    };`);

if (errs.length) {
  console.error("ABORT -- nothing written:");
  errs.forEach(function(e){ console.error("  " + e); });
  process.exit(1);
}

let out = hadCRLF ? s.replace(/\n/g, "\r\n") : s;
fs.writeFileSync(DST, out, "utf8");
const chk = fs.readFileSync(DST, "utf8");
const must = ["__KV_V240: guaranteed ROLL button", "__KV_V240: settle after resync", "window.KV.chain=async function()"];
const missing = must.filter(function(x){ return chk.indexOf(x) < 0; });
if (missing.length) { console.error("POST-WRITE CHECK FAILED", missing); process.exit(1); }
console.log("OK -> " + DST + "  (" + chk.length + " chars)");
