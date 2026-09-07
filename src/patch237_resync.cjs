// patch237_resync.cjs
// SRC showcase_kascity236.html -> DST showcase_kascity237.html
// Failsafe: the flux log is the record. On stall, re-query the orderer's full /log,
// rebuild KV_MOVES from the server entries (server i = slot), adopt the newest
// snapshot, step the engine to the expected seat, and re-ask.
//   - M.resync() + KV.resync() manual command
//   - auto-trigger A: our seat's turn, no prompt visible, no modal, 4s stagnant
//   - auto-trigger B: any seat, 20s with no new moves
//   - throttled to once per 10s; rebuilt records flagged __sent so the outbound
//     tail does not re-append them; dedup map reset
// Count-guarded, CRLF-safe, abort-before-write.

const fs = require("fs");
const SRC = "showcase_kascity236.html";
const DST = "showcase_kascity237.html";

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

// ---------- P1: resync engine, inserted before the status strip ----------
rep("P1-resync",
  "  // ---- status strip ----",
`  // ---- __KV_V237: full-log resync -- the flux chain is the record; rebuild from it ----
  M.__lastResync = 0;
  M.resync = async function(reason){
    if(Date.now() - M.__lastResync < 10000) return false;
    M.__lastResync = Date.now();
    try{
      var lg = await ord("/api/game/room/"+M.room+"/log?after=0");
      var entries = (lg && lg.entries) || [];
      var arr = [], lastMove = null, newestSnap = null;
      for(var i=0;i<entries.length;i++){
        var e = entries[i];
        if(e.kind==="gun"){
          var gb=e.body||{};
          if(!M.gunArmed) M.armGun(Number(gb.startDaa!=null?gb.startDaa:gb.v), gb.seed||null, gb.players||M.roster.length);
          continue;
        }
        if(e.kind!=="move") continue;
        var b=e.body||{};
        var rec={ i:e.i, s:b.s, a:b.a, v:b.v, t:b.t, hash:b.hash||null, snap:b.snap||null, fx:b.fx||null, __sent:1 };
        arr[e.i]=rec; lastMove=rec;
        if(rec.snap) newestSnap=rec;
        M.seen[e.i]=1;
      }
      window.KV_MOVES = arr;
      M.logN = entries.length;
      M.queue = [];
      window.__KV_DEDUP176 = {};
      if(newestSnap && window.KV_ADOPT) window.KV_ADOPT(newestSnap.snap);
      // expected seat: mid-turn if the last entry is a roll, otherwise the next seat
      var exp = M.seat;
      if(lastMove){
        exp = (String(lastMove.a)==="roll") ? lastMove.s : ((lastMove.s%4)+1);
      }
      if(window.KV_SETSTATE){
        window.KV_SETSTATE("turn", exp-1); window.KV_SETSTATE("seat", exp);
        window.KV_SETSTATE("phase",0); window.KV_SETSTATE("moved",0);
        window.KV_SETSTATE("asked",0); window.KV_SETSTATE("go",-1);
        window.KV_SETSTATE("buy",-1); window.KV_SETSTATE("buy_tile",-1);
        if(M.seat) window.KV_SETSTATE("hud_seat", M.seat);
      }
      log("RESYNC ("+(reason||"manual")+"): "+entries.length+" entries from the chain \\u2014 engine to P"+exp, "#f0c860");
      console.log("[KV RESYNC]", reason||"manual", entries.length, "-> P"+exp);
      return true;
    }catch(e){
      log("resync failed: "+((e&&e.message)||e), "#ff6a4a");
      return false;
    }
  };
  (function(){
    var lastLen=-1, lastAt=Date.now();
    setInterval(function(){
      try{
        if(!M.started || M.halted) return;
        var n=(window.KV_MOVES||[]).length;
        if(n!==lastLen){ lastLen=n; lastAt=Date.now(); return; }
        var idle = Date.now()-lastAt;
        var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};
        var prompt=document.querySelector("div[data-i]");
        var vis=!!(prompt && (prompt.offsetWidth||prompt.offsetHeight));
        var modal=!!document.querySelector("[data-kvmodal]");
        // A: our turn, nothing to click, 4s -> requery the chain
        if((f.seat||1)===M.seat && !vis && !modal && idle>4000){ M.resync("our turn, no roll, 4s"); return; }
        // B: nothing moving anywhere for 20s -> requery the chain
        if(idle>20000 && !modal){ M.resync("stagnant 20s"); }
      }catch(e){}
    }, 2000);
  })();

  // ---- status strip ----`);

// ---------- P2: KV.resync command ----------
rep("P2-command",
  '    window.KV.daa=async function(){ var d=await M.daaNow(); console.log("DAA:",d); return d; };',
`    window.KV.resync=function(){ return M.resync("manual"); };   // __KV_V237
    window.KV.daa=async function(){ var d=await M.daaNow(); console.log("DAA:",d); return d; };`);

if (errs.length) {
  console.error("ABORT -- nothing written:");
  errs.forEach(function(e){ console.error("  " + e); });
  process.exit(1);
}

let out = hadCRLF ? s.replace(/\n/g, "\r\n") : s;
fs.writeFileSync(DST, out, "utf8");
const chk = fs.readFileSync(DST, "utf8");
const must = ["__KV_V237: full-log resync", "window.KV.resync=function()", "[KV RESYNC]"];
const missing = must.filter(function(x){ return chk.indexOf(x) < 0; });
if (missing.length) { console.error("POST-WRITE CHECK FAILED", missing); process.exit(1); }
console.log("OK -> " + DST + "  (" + chk.length + " chars)");
