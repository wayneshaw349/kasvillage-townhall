// patch248_decisionclose.cjs
// SRC showcase_kascity247.html -> DST showcase_kascity248.html
// Probe verdict: chain correct through P1's roll i7, but P1's post-roll state was wiped
// (moved:0 phase:0) by a trigger-A resync firing inside P1's own decision window, so the
// landing ask can never be regenerated -- asked=0 nudges are useless against a pre-move
// engine state.
//   A1: trigger A ("our turn, no roll, 4s") skips when WE are the roller mid-decision --
//       that window belongs to the decision re-ask, not to a state-wiping resync.
//   A2: decision re-ask escalates -- 2 nudges (12s), then records an explicit "pass" to
//       close the turn on-chain. Economically safe (a stray pass on a non-purchase
//       landing is a no-op) and guarantees liveness; groundwork for the future end: marker.
// Count-guarded, CRLF-safe, abort-before-write.

const fs = require("fs");
const SRC = "showcase_kascity247.html";
const DST = "showcase_kascity248.html";

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

// ---------- A1: trigger A is roller-aware ----------
rep("A1-triggerA",
  `        if((f.seat||1)===M.seat && !vis && !modal && idle>4000){ M.resync("our turn, no roll, 4s"); return; }`,
`        if((f.seat||1)===M.seat && !vis && !modal && idle>4000){
          // __KV_V248: if WE are the roller mid-decision, this window belongs to the
          // decision re-ask -- a resync here wipes the post-roll state and strands the ask
          var mvA=(window.KV_MOVES||[]), lrA=null, liA=-1;
          for(var ai=mvA.length-1;ai>=0;ai--){ var ra=mvA[ai]; if(ra && String(ra.a)==="roll"){ lrA=ra; liA=ai; break; } }
          var midOurs=false;
          if(lrA && lrA.s===M.seat){ midOurs=true;
            for(var aj=liA+1;aj<mvA.length;aj++){ var qa=mvA[aj]; if(qa && qa.s===M.seat){ midOurs=false; break; } } }
          if(!midOurs){ M.resync("our turn, no roll, 4s"); }
          return;
        }`);

// ---------- A2: lost decision escalates to an explicit pass ----------
rep("A2-escalate",
`          lastKey=dkey; lastAt=Date.now();
          log("re-asking P"+seatNow+"'s landing decision", "#caa64c");
          if(window.KV_SETSTATE) window.KV_SETSTATE("asked",0);
          return;`,
`          lastKey=dkey; lastAt=Date.now();
          M.__dnudge=(M.__dnudge && M.__dnudge.k===dkey)?M.__dnudge:{k:dkey,n:0};
          M.__dnudge.n++;
          if(M.__dnudge.n<=2){
            log("re-asking P"+seatNow+"'s landing decision ("+M.__dnudge.n+"/2)", "#caa64c");
            if(window.KV_SETSTATE) window.KV_SETSTATE("asked",0);
            return;
          }
          // __KV_V248: the ask is unrecoverable -- close the turn with an explicit pass
          log("P"+seatNow+"'s decision window lost \\u2014 recording pass to close the turn", "#e0a040");
          if(window.KV_MOVE) window.KV_MOVE(seatNow, "pass", 0);
          return;`);

if (errs.length) {
  console.error("ABORT -- nothing written:");
  errs.forEach(function(e){ console.error("  " + e); });
  process.exit(1);
}

let out = hadCRLF ? s.replace(/\n/g, "\r\n") : s;
fs.writeFileSync(DST, out, "utf8");
const chk = fs.readFileSync(DST, "utf8");
const must = ["__KV_V248: if WE are the roller mid-decision", "recording pass to close the turn"];
const missing = must.filter(function(x){ return chk.indexOf(x) < 0; });
if (missing.length) { console.error("POST-WRITE CHECK FAILED", missing); process.exit(1); }
console.log("OK -> " + DST + "  (" + chk.length + " chars)");
