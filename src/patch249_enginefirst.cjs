// patch249_enginefirst.cjs
// SRC showcase_kascity248.html -> DST showcase_kascity249.html
// CONSOLIDATION: restore the single-player model. The engine is the pacer for owned
// seats (exactly like solo); the relay v52-54 gate is the only sequencer; remote seats
// are injected inputs. Client-side second-guessing is removed:
//   E1: turn grant no longer VOIDS engine output or triggers resync -- owned-seat
//       records always land locally (single-player feel); the outbound tail's hold +
//       the relay gate decide what reaches the chain.
//   E2: trigger-A resync ("our turn, no roll, 4s") deleted -- it wiped mid-turn state.
//       Resync remains for: chain-ahead stagnation, relay refusal, divergence, manual.
//   E3: self-heal adopts the snapshot only -- it never steps seat/turn/phase again.
//   E4: turn watchdog idle threshold 8s -> 15s (it stays decision-aware from 247).
//   E5: ROLL button shows only when the chain grants us AND the engine is on our seat
//       (or its own ask is up) -- the button stops bypassing engine pacing; the 20s
//       human grace is gone from the button (engine agreement replaces it).
//   E6: outbound human grace 20s -> 6s (the relay gate is authoritative anyway).
// Count-guarded, CRLF-safe, abort-before-write.

const fs = require("fs");
const SRC = "showcase_kascity248.html";
const DST = "showcase_kascity249.html";

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

// ---------- E1: grant no longer voids -- delete the whole choke-point block ----------
span("E1-grant-out",
`      // __KV_V245: turn grant -- the chain is the clock; off-turn engine output is void`,
`      var rec={i:__idx, s:seat, a:action, v:arg, t:left};
      if(fx) rec.fx = fx;`,
`      // __KV_V249: engine-first -- owned-seat output always records locally (solo feel);
      // the outbound hold + the relay gate decide what reaches the chain
      var rec={i:__idx, s:seat, a:action, v:arg, t:left};
      if(fx) rec.fx = fx;`);

// ---------- E2: trigger-A resync deleted ----------
span("E2-triggerA-out",
`        if((f.seat||1)===M.seat && !vis && !modal && idle>4000){`,
`          if(!midOurs){ M.resync("our turn, no roll, 4s"); }
          return;
        }`,
`        // __KV_V249: trigger A removed -- it wiped mid-turn state; the decision re-ask
        // and the ROLL button own that window now`);

// ---------- E3: self-heal adopts only, never steps ----------
rep("E3-selfheal",
`        if(window.KV_SETSTATE && __cur!==exp){
          window.KV_SETSTATE("turn", exp-1); window.KV_SETSTATE("seat", exp);
          window.KV_SETSTATE("phase",0); window.KV_SETSTATE("moved",0);
          window.KV_SETSTATE("asked",0); window.KV_SETSTATE("go",-1);
          window.KV_SETSTATE("buy",-1); window.KV_SETSTATE("buy_tile",-1);
        }
        log("self-heal: snapshot "+pick.i+" (P"+pick.s+") engine P"+__cur+"->P"+exp, "#9cd87c");`,
`        // __KV_V249: adopt-only -- the engine's own pacing owns the seat pointer
        log("self-heal: adopted snapshot "+pick.i+" (P"+pick.s+"), engine untouched (P"+__cur+")", "#9cd87c");`);

// ---------- E4: watchdog idle 8s -> 15s ----------
rep("E4-watchdog-idle",
  "        if(Date.now()-lastChange<8000) return;                // engine may just be thinking",
  "        if(Date.now()-lastChange<15000) return;               // __KV_V249: engine may just be thinking");

// ---------- E5: ROLL button requires engine agreement ----------
rep("E5-button",
`      for(var j=lri+1;j<mv.length;j++){ var q=mv[j];
        if(q && q.s===lr.s) return true; }                        // __KV_V247: roller progressed
      var __botB=(M.roster && M.roster.length && lr.s>M.roster.length);
      return (Date.now()-(M.__lastLogAt||0)) > (__botB?3500:20000) && !(M.queue||[]).length;`,
`      var __prog=false;
      for(var j=lri+1;j<mv.length;j++){ var q=mv[j];
        if(q && q.s===lr.s){ __prog=true; break; } }              // __KV_V247: roller progressed
      if(!__prog){
        var __botB=(M.roster && M.roster.length && lr.s>M.roster.length);
        if((Date.now()-(M.__lastLogAt||0)) <= (__botB?3500:6000) || (M.queue||[]).length) return false;
      }
      // __KV_V249: the engine must agree it is our seat -- the button assists the
      // engine's own pacing, it does not bypass it
      return ((f.seat||1)===M.seat);`);

// ---------- E6: outbound human grace 20s -> 6s ----------
rep("E6-outbound-grace",
  "                if(Date.now()-(M.__lastLogAt||0) < (__bot2?3500:20000)) continue;",
  "                if(Date.now()-(M.__lastLogAt||0) < (__bot2?3500:6000)) continue;   // __KV_V249");

if (errs.length) {
  console.error("ABORT -- nothing written:");
  errs.forEach(function(e){ console.error("  " + e); });
  process.exit(1);
}

let out = hadCRLF ? s.replace(/\n/g, "\r\n") : s;
fs.writeFileSync(DST, out, "utf8");
const chk = fs.readFileSync(DST, "utf8");
const must = ["__KV_V249: engine-first", "__KV_V249: trigger A removed", "__KV_V249: adopt-only", "engine untouched"];
const missing = must.filter(function(x){ return chk.indexOf(x) < 0; });
if (missing.length) { console.error("POST-WRITE CHECK FAILED", missing); process.exit(1); }
console.log("OK -> " + DST + "  (" + chk.length + " chars)");
