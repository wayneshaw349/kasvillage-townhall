// patch247_decisionaware.cjs
// SRC showcase_kascity246.html -> DST showcase_kascity247.html
// Preemption bug: every "next = (lastRoll.s % 4) + 1" site treated a turn as over at the
// roll, so P2's ROLL button unlocked (3.5s quiet fallback) while P1's buy/pass was still
// pending, and the turn watchdog stepped engines past a human mid-decision. Meanwhile the
// restorer refused to re-ask OUR OWN landing decision. Fixes:
//   S1 grant, S2 outbound gate, S3 ROLL button, S4 turn watchdog: the roller's turn is
//      not over until they PROGRESS (any subsequent record by that seat -- decision, cash,
//      mgmt). No progression: bots get a 3.5s quiet grace, humans 20s.
//   S5 restorer: when WE rolled and our decision is missing (no prompt, no progression),
//      nudge the ask (asked=0) every 6s instead of returning.
// Count-guarded, CRLF-safe, abort-before-write.

const fs = require("fs");
const SRC = "showcase_kascity246.html";
const DST = "showcase_kascity247.html";

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

// ---------- S1: turn grant respects the pending decision ----------
span("S1-grant",
`          var __ok = true, __mvT = window.KV_MOVES, __lrT = null;`,
`            else if (__mp.opener != null) __ok = (seat === __mp.opener);
          } else {`,
`          var __ok = true, __mvT = window.KV_MOVES, __lrT = null, __li = -1;
          for (var __t=__mvT.length-1; __t>=0; __t--) { var __rT=__mvT[__t]; if(__rT && String(__rT.a)==="roll"){ __lrT=__rT; __li=__t; break; } }
          if (String(action)==="roll") {
            if (__lrT) {
              __ok = (seat === ((__lrT.s % 4) + 1));
              if (__ok) {
                // __KV_V247: previous roller must progress before the next roll
                var __dn=false;
                for (var __u=__li+1; __u<__mvT.length; __u++){ var __qT=__mvT[__u]; if(__qT && __qT.s===__lrT.s){ __dn=true; break; } }
                if(!__dn){
                  var __botG=(__mp.roster && __mp.roster.length && __lrT.s>__mp.roster.length);
                  if (Date.now() - (__mp.__lastLogAt||0) < (__botG?3500:20000)) __ok = false;
                }
              }
            }
            else if (__mp.opener != null) __ok = (seat === __mp.opener);
          } else {`);

// ---------- S2: outbound gate respects the pending decision ----------
span("S2-outbound",
`          var __mvG=(window.KV_MOVES||[]), __lr=null;`,
`          else { if(!__lr || __lr.s!==rec.s) continue; }`,
`          var __mvG=(window.KV_MOVES||[]), __lr=null, __gi=-1;
          for(var __g=__mvG.length-1;__g>=0;__g--){ var __r=__mvG[__g];
            if(__r && __r!==rec && String(__r.a)==="roll"){ __lr=__r; __gi=__g; break; } }
          if(__a==="roll"){
            if(__lr){
              if(rec.s!==((__lr.s%4)+1)) continue;
              // __KV_V247: previous roller must progress first (bot 3.5s / human 20s grace)
              var __dn2=false;
              for(var __u2=__gi+1;__u2<__mvG.length;__u2++){ var __q2=__mvG[__u2]; if(__q2 && __q2!==rec && __q2.s===__lr.s){ __dn2=true; break; } }
              if(!__dn2){
                var __bot2=(M.roster && M.roster.length && __lr.s>M.roster.length);
                if(Date.now()-(M.__lastLogAt||0) < (__bot2?3500:20000)) continue;
              }
            }
            else { var __op=M.opener; if(__op!=null && rec.s!==__op) continue; }   // __KV_V243
          }
          else { if(!__lr || __lr.s!==rec.s) continue; }`);

// ---------- S3: ROLL button respects the pending decision ----------
rep("S3-button",
`      for(var j=lri+1;j<mv.length;j++){ var q=mv[j];
        if(q && q.s===lr.s && /^(buy|pass)$/.test(String(q.a))) return true; }   // roller decided
      // rent-only landings record no buy/pass: unlock after the log goes quiet
      return (Date.now()-(M.__lastLogAt||0)) > 3500 && !(M.queue||[]).length;`,
`      for(var j=lri+1;j<mv.length;j++){ var q=mv[j];
        if(q && q.s===lr.s) return true; }                        // __KV_V247: roller progressed
      var __botB=(M.roster && M.roster.length && lr.s>M.roster.length);
      return (Date.now()-(M.__lastLogAt||0)) > (__botB?3500:20000) && !(M.queue||[]).length;`);

// ---------- S4: turn watchdog respects the pending decision ----------
rep("S4-watchdog",
`        if(!lastRoll) return;
        var exp=(lastRoll.s%4)+1;
        if(seatNow===exp) return;`,
`        if(!lastRoll) return;
        // __KV_V247: the roller's turn is not over until they progress
        var __wli=-1; for(var __wi=mv.length-1;__wi>=0;__wi--){ if(mv[__wi]===lastRoll){ __wli=__wi; break; } }
        var __wdn=false; for(var __wj=__wli+1;__wj<mv.length;__wj++){ var __wq=mv[__wj]; if(__wq && __wq.s===lastRoll.s){ __wdn=true; break; } }
        var exp=__wdn ? ((lastRoll.s%4)+1) : lastRoll.s;
        if(seatNow===exp) return;`);

// ---------- S5: restorer re-asks our own missing decision ----------
rep("S5-decision-reask",
  "        if(lastRoll && lastRoll.s===seatNow) return;           // that seat already rolled this turn",
`        if(lastRoll && lastRoll.s===seatNow){
          // __KV_V247: we rolled but the landing decision never got asked -- nudge it
          var __dli=-1; for(var __di=mv.length-1;__di>=0;__di--){ if(mv[__di]===lastRoll){ __dli=__di; break; } }
          var __ddn=false; for(var __dj=__dli+1;__dj<mv.length;__dj++){ var __dq=mv[__dj]; if(__dq && __dq.s===seatNow){ __ddn=true; break; } }
          if(__ddn) return;
          var dkey="d/"+(f.turn||0)+"/"+seatNow+"/"+mv.length;
          if(dkey===lastKey && Date.now()-lastAt<6000) return;
          lastKey=dkey; lastAt=Date.now();
          log("re-asking P"+seatNow+"'s landing decision", "#caa64c");
          if(window.KV_SETSTATE) window.KV_SETSTATE("asked",0);
          return;
        }`);

if (errs.length) {
  console.error("ABORT -- nothing written:");
  errs.forEach(function(e){ console.error("  " + e); });
  process.exit(1);
}

let out = hadCRLF ? s.replace(/\n/g, "\r\n") : s;
fs.writeFileSync(DST, out, "utf8");
const chk = fs.readFileSync(DST, "utf8");
const must = ["__KV_V247: previous roller must progress before the next roll", "__KV_V247: roller progressed", "re-asking P\"+seatNow+\"'s landing decision"];
const missing = must.filter(function(x){ return chk.indexOf(x) < 0; });
if (missing.length) { console.error("POST-WRITE CHECK FAILED", missing); process.exit(1); }
console.log("OK -> " + DST + "  (" + chk.length + " chars)");
