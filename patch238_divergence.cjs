// patch238_divergence.cjs
// SRC showcase_kascity237.html -> DST showcase_kascity238.html
// Continuous divergence detection at zero extra bytes:
//   - poll captures the relay's running chain hash + head (already in every /log reply)
//   - detector compares our live engine snapshot against the chain's newest snapshot;
//     2 strikes 3s apart (6s of disagreement, with nothing pending, no human deciding,
//     nothing of ours still un-appended) -> M.resync("state diverged from chain")
// Note: local KV_ROOT and the relay chain use different constructions, so the honest
// comparison is state-vs-chain-snapshot, not hash-vs-hash.
// Count-guarded, CRLF-safe, abort-before-write.

const fs = require("fs");
const SRC = "showcase_kascity237.html";
const DST = "showcase_kascity238.html";

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

// ---------- P1: capture chain head on every poll ----------
rep("P1-chainhead",
  '        var lg = await ord("/api/game/room/"+M.room+"/log?after="+(M.logN||0));',
`        var lg = await ord("/api/game/room/"+M.room+"/log?after="+(M.logN||0));
        if(lg){ M.chainHead = lg.chain || M.chainHead; M.head = (lg.head!=null ? lg.head : M.head); }   // __KV_V238`);

// ---------- P2: divergence detector ----------
rep("P2-detector",
  "  // ---- status strip ----",
`  // ---- __KV_V238: divergence detector -- engine state vs the chain's newest snapshot ----
  (function(){
    var strikes=0;
    setInterval(function(){
      try{
        if(!M.started || M.halted) return;
        if((M.queue||[]).length){ strikes=0; return; }
        if(document.querySelector("[data-kvmodal]")){ strikes=0; return; }
        var pr=document.querySelector("div[data-i]");
        if(pr && (pr.offsetWidth||pr.offsetHeight)){ strikes=0; return; }   // a human is deciding
        var mv=(window.KV_MOVES||[]);
        for(var i=mv.length-1;i>=0;i--){ var r=mv[i];
          if(r && !r.__sent && (r.s===M.seat || (M.owns&&M.owns(r.s)))){ strikes=0; return; } }   // ours still un-appended
        var pick=null;
        for(var j=mv.length-1;j>=0;j--){ var q=mv[j]; if(q && q.snap){ pick=q; break; } }
        if(!pick || !window.KV_SNAPSHOT) return;
        var ours=null; try{ ours=window.KV_SNAPSHOT(); }catch(e){}
        if(ours===pick.snap){ strikes=0; return; }
        strikes++;
        if(strikes>=2){ strikes=0;
          log("engine drifted from the chain \\u2014 resyncing", "#e0a040");
          M.resync("state diverged from chain"); }
      }catch(e){}
    }, 3000);
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
const must = ["__KV_V238: divergence detector", "M.chainHead = lg.chain"];
const missing = must.filter(function(x){ return chk.indexOf(x) < 0; });
if (missing.length) { console.error("POST-WRITE CHECK FAILED", missing); process.exit(1); }
console.log("OK -> " + DST + "  (" + chk.length + " chars)");
